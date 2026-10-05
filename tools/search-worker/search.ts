// 検索の SQL と索引の入れ替え。Cloudflare にも Node にも依存しない純粋な関数で、
// Worker (Durable Object の SQLite) と品質テスト (node:sqlite) が同じコードを使う。
//
// 設計と根拠:
// - 日本語は分かち書き不要の FTS5 trigram を使う (https://sqlite.org/fts5.html#the_trigram_tokenizer)。
//   部分文字列一致を索引で引けるので存在しない語を切り詰めて当てる偽ヒットも出ない。
// - trigram は3文字未満の語に一致しない。3文字未満の語は FTS を使わず本文への LIKE で補う (記事は数百件なので全走査でよい)。
// - 大文字小文字は trigram の case_sensitive 0 (既定) に任せ、本文は NFKC 正規化だけを掛けて小文字化しない。
//   小文字化すると snippet() の抜粋が小文字になり、コードの識別子の表示が崩れるため。
// - locale は別テーブル (fts_ja / fts_en) に分ける。
// - 順位は bm25 (題名 10、本文 1)。3文字未満の語のみのクエリは bm25 が使えないので、題名一致 → 出現回数の順にする。
// - 検索語は FTS5 の文字列リテラルとして束縛し、構文として解釈させない。
// - 抜粋と一致箇所: 応答は平文の `snippet` と、その中の一致範囲 `highlights` ([start, end) の UTF-16 位置の組の配列) を別々に返す。
//   強調の区切り文字を本文の文字列に埋め込んだり HTML にしたりしないので、`<` や `&` を含む本文でも、
//   表示側が textContent と slice で組み立てれば (HTML として挿入しなくても) 安全に強調できる。
//   範囲の出どころは検索エンジンの判定で、3文字以上の語は FTS5 の highlight() の区切り文字、3文字未満の語は LIKE と同じ判定 (ASCII の大文字小文字を区別しない部分一致) である。
//   highlight() の区切り文字には本文に出ない制御文字 (U+0001, U+0002) を使い、索引に入れる時点で本文と題名から取り除いておく。
//   位置は NFKC 正規化後 (索引に入っている文字列) の抜粋の位置で、UTF-16 の位置は JS の slice とそのまま対応する。
// - 抜粋の長さ: snippet() は 64 トークンまでで、trigram では約 66 文字にしかならない。そこで highlight() で本文全体の一致箇所を得て、
//   一致が最も多く入る約 160 文字の範囲を、文の境目で切り出す。

export type Locale = 'ja' | 'en';

/** 索引に入れる記事 1 件。body は markdown を平文化したもの (plain.ts) */
export type IndexDoc = {
  slug: string;
  locale: Locale;
  title: string;
  /** 一覧と同じ書式 (Asia/Tokyo の yyyy-MM-dd) */
  date: string;
  channels: string[];
  body: string;
};

/** 抜粋 (snippet) の中の一致範囲。[start, end) の UTF-16 の位置で、昇順かつ互いに重ならない */
export type Highlight = [start: number, end: number];

export type SearchHit = {
  slug: string;
  title: string;
  date: string;
  channels: string[];
  /** 平文 (HTML ではない)。改行を含まない */
  snippet: string;
  highlights: Highlight[];
};

/** SQL を実行して行の配列を返す関数。DO の storage.sql と node:sqlite の差をここで吸収する */
export type SqlExec = (sql: string, ...binds: unknown[]) => Record<string, unknown>[];

export const LIMIT = 20;
const W_TITLE = 10;
const W_BODY = 1;
// 抜粋の切り出し範囲: 最初の一致の前に取る文字数の目安、全体の長さの目安、文の境目を探す範囲
const EXCERPT_LENGTH = 160;
const EXCERPT_LEAD = 50;
const BOUNDARY_BACK = 30;
const BOUNDARY_FORWARD = 50;
const ELLIPSIS = '…';
// highlight() の一致の区切り文字。本文に出ない制御文字。索引に入れる時に本文から取り除く
const MARK_START = '\u0001';
const MARK_END = '\u0002';
// 1 リクエストで受け付ける検索語の数の上限 (SQL の束縛変数は 100 個まで)
const MAX_TERMS = 8;

const COLUMNS = { slug: 0, rawTitle: 1, date: 2, channels: 3, title: 4, body: 5 } as const;
// bm25 の重みは列の順 (UNINDEXED 列を含む)。UNINDEXED 列は 0
const BM25_WEIGHTS = `0, 0, 0, 0, ${W_TITLE}, ${W_BODY}`;

const LOCALES: Locale[] = ['ja', 'en'];
const table = (locale: Locale) => `fts_${locale}`;

// 索引と検索の両側で同じ正規化 (NFKC) を掛ける。全角と半角、互換文字の表記ゆれを吸収する
export const normalize = (s: string) => s.normalize('NFKC');
// 索引に入れる文字列: NFKC 正規化し、一致の区切り文字と同じ制御文字を取り除く
const toIndexed = (s: string) => normalize(s).split(MARK_START).join('').split(MARK_END).join('');

const len = (s: string) => [...s].length;
const ftsPhrase = (s: string) => `"${s.replace(/"/g, '""')}"`;
const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

const createTable = (locale: Locale) =>
  `CREATE VIRTUAL TABLE IF NOT EXISTS ${table(locale)} USING fts5(slug UNINDEXED, raw_title UNINDEXED, date UNINDEXED, channels UNINDEXED, title, body, tokenize='trigram')`;

/** 表が無ければ作る。索引が空でも検索が空の結果を返せるようにする */
export function ensureSchema(exec: SqlExec): void {
  for (const l of LOCALES) exec(createTable(l));
}

/**
 * 索引を全件入れ替える。呼び出し側が 1 つのトランザクションで包むこと (DO は transactionSync)。
 * 表ごと作り直すので、スキーマを変えた次のデプロイでもデータの移行が要らない。
 */
export function replaceAll(exec: SqlExec, docs: IndexDoc[]): void {
  for (const l of LOCALES) {
    exec(`DROP TABLE IF EXISTS ${table(l)}`);
    exec(createTable(l));
  }
  for (const d of docs) {
    exec(
      `INSERT INTO ${table(d.locale)}(slug, raw_title, date, channels, title, body) VALUES (?, ?, ?, ?, ?, ?)`,
      d.slug,
      d.title,
      d.date,
      JSON.stringify(d.channels),
      toIndexed(d.title),
      toIndexed(d.body),
    );
  }
  for (const l of LOCALES) exec(`INSERT INTO ${table(l)}(${table(l)}) VALUES('optimize')`);
}

export function queryTerms(q: string): string[] {
  return normalize(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** highlight() の区切り文字を取り除いて平文にし、区切り文字の位置を一致範囲にする */
function parseMarks(marked: string): { text: string; ranges: Highlight[] } {
  const ranges: Highlight[] = [];
  let text = '';
  let start = -1;
  for (const ch of marked) {
    if (ch === MARK_START) start = text.length;
    else if (ch === MARK_END) {
      if (start >= 0 && text.length > start) ranges.push([start, text.length]);
      start = -1;
    } else text += ch;
  }
  return { text, ranges };
}

// SQLite の lower() と LIKE は ASCII の大文字小文字だけを区別しない。位置がずれないよう同じ規則で比べる
const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => c.toLowerCase());

/** 3文字未満の語の一致範囲。LIKE '%語%' と同じ判定 (ASCII の大文字小文字を区別しない部分一致) の出現位置 */
function likeRanges(text: string, terms: string[]): Highlight[] {
  const lower = asciiLower(text);
  const out: Highlight[] = [];
  for (const t of terms) {
    const needle = asciiLower(t);
    for (let i = lower.indexOf(needle); i >= 0; i = lower.indexOf(needle, i + needle.length)) {
      out.push([i, i + needle.length]);
    }
  }
  return out;
}

/** 昇順に並べ、重なる範囲と隣り合う範囲を 1 つにまとめる */
function mergeRanges(ranges: Highlight[]): Highlight[] {
  const out: Highlight[] = [];
  for (const [s, e] of [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1])) {
    const last = out[out.length - 1] as Highlight | undefined;
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else out.push([s, e]);
  }
  return out;
}

const isSentenceEnd = (text: string, i: number) => {
  const c = text[i];
  return '。！？!?'.includes(c) || (c === '.' && (i + 1 >= text.length || text[i + 1] === ' '));
};
const isWordChar = (c: string | undefined) => c !== undefined && /[A-Za-z0-9]/.test(c);

/**
 * 一致が最も多く入る約 EXCERPT_LENGTH 文字の範囲を、文の境目で切り出す。
 * 一致が無ければ (題名だけの一致) 本文の先頭から取る。
 */
function excerpt(text: string, ranges: Highlight[]): { snippet: string; highlights: Highlight[] } {
  if (text.length <= EXCERPT_LENGTH) return { snippet: text, highlights: ranges };

  // 抜粋の先頭に置く一致: 抜粋に入る一致の数が最も多いもの (同数なら先に出るもの)。
  // どの一致も入りきらないときも、その一致自身は数える (最小 1)。しゃくとり法で線形時間にする
  let anchor = 0;
  let best = 0;
  let last = 0;
  ranges.forEach(([s], i) => {
    last = Math.max(last, i + 1);
    while (last < ranges.length && ranges[last][1] <= s + EXCERPT_LENGTH - EXCERPT_LEAD) last++;
    if (last - i > best) {
      best = last - i;
      anchor = s;
    }
  });

  // 先頭: 一致の手前の文の境目。無ければ語の途中を避けて切る
  let start = Math.max(0, anchor - EXCERPT_LEAD);
  if (start > 0) {
    let found = -1;
    for (let i = anchor - 1; i >= Math.max(0, start - BOUNDARY_BACK); i--) {
      if (isSentenceEnd(text, i)) {
        found = i + 1;
        break;
      }
    }
    if (found >= 0) {
      start = found;
      while (text[start] === ' ') start++;
    } else if (isWordChar(text[start - 1]) && isWordChar(text[start])) {
      const space = text.indexOf(' ', start);
      if (space >= 0 && space < anchor) start = space + 1;
    }
  }

  // 末尾: 抜粋に始まる一致は最後まで含め、そこから先の文の境目で切る。無ければ語の途中を避けて切る
  let end = start + EXCERPT_LENGTH;
  for (const [s, e] of ranges) if (s < end && e > end) end = e;
  let boundary = -1;
  for (let i = end - 1; i < Math.min(text.length, end + BOUNDARY_FORWARD); i++) {
    if (isSentenceEnd(text, i)) {
      boundary = i + 1;
      break;
    }
  }
  if (boundary >= 0) end = boundary;
  else if (end < text.length && isWordChar(text[end - 1]) && isWordChar(text[end])) {
    const space = text.lastIndexOf(' ', end);
    if (space > start) end = space;
  }
  end = Math.min(end, text.length);

  // 一致範囲が抜粋の外に出ないよう、端にかかる一致があれば抜粋を広げてから切り出す
  for (const [s, e] of ranges) {
    if (s < end && e > end) end = e;
    if (s < start && e > start) start = s;
  }
  const prefix = start > 0 ? ELLIPSIS : '';
  const suffix = end < text.length ? ELLIPSIS : '';
  const shift = prefix.length - start;
  const highlights = ranges
    .filter(([s, e]) => s >= start && e <= end)
    .map(([s, e]): Highlight => [s + shift, e + shift]);
  return { snippet: prefix + text.slice(start, end) + suffix, highlights };
}

export function search(exec: SqlExec, q: string, locale: Locale, limit = LIMIT): SearchHit[] {
  const terms = queryTerms(q);
  if (terms.length === 0) return [];
  const t = table(locale);
  const long = terms.filter((x) => len(x) >= 3);
  const short = terms.filter((x) => len(x) < 3);

  const where: string[] = [];
  const params: unknown[] = [];
  if (long.length) {
    where.push(`${t} MATCH ?`);
    params.push(long.map(ftsPhrase).join(' AND '));
  }
  for (const s of short) {
    where.push(`(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')`);
    params.push(`%${likeEscape(s)}%`, `%${likeEscape(s)}%`);
  }

  const cols = `slug, raw_title AS title, date, channels`;
  let rows: Record<string, unknown>[];
  if (long.length) {
    // highlight() は MATCH を使うクエリでだけ使える。本文の列 (5) の全体を、FTS5 が一致と判定した箇所に区切り文字で挟んで返す
    const sql = `SELECT ${cols}, highlight(${t}, ${COLUMNS.body}, ?, ?) AS body
      FROM ${t} WHERE ${where.join(' AND ')}
      ORDER BY bm25(${t}, ${BM25_WEIGHTS}), slug LIMIT ${limit}`;
    rows = exec(sql, MARK_START, MARK_END, ...params);
  } else {
    // 3文字未満の語のみ: FTS を使わないので highlight() も bm25 も使えない。本文をそのまま返し、一致範囲は LIKE と同じ判定で求める
    const score = short.map(
      () => `((title LIKE ? ESCAPE '\\')*1000 + (length(body)-length(replace(lower(body), ?, '')))/MAX(length(?),1))`,
    );
    const scoreParams = short.flatMap((s) => [`%${likeEscape(s)}%`, s, s]);
    const sql = `SELECT ${cols}, body
      FROM ${t} WHERE ${where.join(' AND ')}
      ORDER BY (${score.join(' + ')}) DESC, slug LIMIT ${limit}`;
    rows = exec(sql, ...params, ...scoreParams);
    // ORDER BY の束縛変数は WHERE の後に並ぶので、渡す順が SQL 中の ? の出現順 (WHERE, ORDER BY) になっている
  }

  return rows.map((r) => {
    // 空白の畳み込みは区切り文字を挟んだ後の文字列に掛ける (区切り文字は空白ではないので位置は区切り文字から求められる)
    const { text, ranges } = parseMarks(collapse(typeof r.body === 'string' ? r.body : ''));
    // 3文字以上の語の一致は FTS5 の区切り文字から、3文字未満の語の一致は LIKE と同じ判定で求め、1 つにまとめる
    const all = mergeRanges([...ranges, ...likeRanges(text, short)]);
    const { snippet, highlights } = excerpt(text, all);
    return {
      slug: String(r.slug),
      title: String(r.title),
      date: String(r.date),
      channels: JSON.parse(String(r.channels)) as string[],
      snippet,
      highlights,
    };
  });
}

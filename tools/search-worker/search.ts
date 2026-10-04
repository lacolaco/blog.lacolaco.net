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

export type SearchHit = { slug: string; title: string; date: string; channels: string[]; snippet: string };

/** SQL を実行して行の配列を返す関数。DO の storage.sql と node:sqlite の差をここで吸収する */
export type SqlExec = (sql: string, ...binds: unknown[]) => Record<string, unknown>[];

export const LIMIT = 20;
const W_TITLE = 10;
const W_BODY = 1;
// FTS5 の snippet() が返す最大のトークン数 (上限 64)。trigram では 1 トークンが 1 文字ずれた 3 文字なので、約 50 文字になる
const SNIPPET_TOKENS = 48;
// 3文字未満の語の抜粋: 一致位置の前後に取る文字数
const SHORT_BEFORE = 30;
const SHORT_LENGTH = 100;
const ELLIPSIS = '…';
// 1 リクエストで受け付ける検索語の数の上限 (SQL の束縛変数は 100 個まで)
const MAX_TERMS = 8;

const COLUMNS = { slug: 0, rawTitle: 1, date: 2, channels: 3, title: 4, body: 5 } as const;
// bm25 の重みは列の順 (UNINDEXED 列を含む)。UNINDEXED 列は 0
const BM25_WEIGHTS = `0, 0, 0, 0, ${W_TITLE}, ${W_BODY}`;

const LOCALES: Locale[] = ['ja', 'en'];
const table = (locale: Locale) => `fts_${locale}`;

// 索引と検索の両側で同じ正規化 (NFKC) を掛ける。全角と半角、互換文字の表記ゆれを吸収する
export const normalize = (s: string) => s.normalize('NFKC');

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
      normalize(d.title),
      normalize(d.body),
    );
  }
  for (const l of LOCALES) exec(`INSERT INTO ${table(l)}(${table(l)}) VALUES('optimize')`);
}

export function queryTerms(q: string): string[] {
  return normalize(q).toLowerCase().split(/\s+/).filter(Boolean).slice(0, MAX_TERMS);
}

const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

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
    // snippet() は MATCH を使うクエリでだけ使える。本文の列 (5) に対する抜粋で、強調の記号は付けない
    const sql = `SELECT ${cols}, snippet(${t}, ${COLUMNS.body}, '', '', '${ELLIPSIS}', ${SNIPPET_TOKENS}) AS snippet
      FROM ${t} WHERE ${where.join(' AND ')}
      ORDER BY bm25(${t}, ${BM25_WEIGHTS}), slug LIMIT ${limit}`;
    rows = exec(sql, ...params);
  } else {
    // 3文字未満の語のみ: FTS を使わないので snippet() も bm25 も使えない。
    // SQLite 標準の instr() と substr() で、最初の語の一致位置の周辺を切り出す。
    // lower() は ASCII のみ対象で文字数が変わらないため、位置は本文の位置と一致する
    const score = short.map(
      () => `((title LIKE ? ESCAPE '\\')*1000 + (length(body)-length(replace(lower(body), ?, '')))/MAX(length(?),1))`,
    );
    const scoreParams = short.flatMap((s) => [`%${likeEscape(s)}%`, s, s]);
    const sql = `SELECT ${cols},
        instr(lower(body), ?) AS pos,
        substr(body, MAX(instr(lower(body), ?) - ${SHORT_BEFORE}, 1), ${SHORT_LENGTH}) AS snippet
      FROM ${t} WHERE ${where.join(' AND ')}
      ORDER BY (${score.join(' + ')}) DESC, slug LIMIT ${limit}`;
    rows = exec(sql, short[0], short[0], ...params, ...scoreParams);
    // ORDER BY の束縛変数は WHERE の後に並ぶので、渡す順が SQL 中の ? の出現順 (SELECT, WHERE, ORDER BY) になっている
  }

  return rows.map((r) => {
    let snippet = oneLine(typeof r.snippet === 'string' ? r.snippet : '');
    if (!long.length) {
      const pos = Number(r.pos);
      if (pos > SHORT_BEFORE + 1) snippet = ELLIPSIS + snippet;
      snippet += ELLIPSIS;
    }
    return {
      slug: String(r.slug),
      title: String(r.title),
      date: String(r.date),
      channels: JSON.parse(String(r.channels)) as string[],
      snippet,
    };
  });
}

/**
 * サイト内検索の品質の仕様。実記事の本文から Worker と同じ SQL (search.ts) で FTS5 の索引を作り、
 * Node の node:sqlite で検索して検証する。ビルド成果物にも Cloudflare にも依存しない。
 *
 * 評価の定義は評価ハーネス (search-eval) と同じ。
 * - substring 正解: NFKC 正規化 + 小文字化した title + 本文に、クエリの全語 (空白区切り) を含む記事
 * - 否定クエリ: substring 正解が 0 件のクエリ。1件でも返したら偽ヒット
 * - 意図記事: 上位3件に入るべき記事 (fixtures/search-intended.json、固定)
 * 意図記事と否定クエリは固定し、substring 正解は記事が増えても追従するよう実行時に本文から計算する。
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { loadCorpus } from './corpus.ts';
import { openMemoryDb } from './sqlite-exec.ts';
import { replaceAll, search, type IndexDoc, type Locale } from './search.ts';

type Query = { id: string; q: string; locale: Locale; category: string };
type Intended = { q: string; locale: Locale; ids: string[] };
const fixture = <T>(name: string) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf-8')) as T;
const queries = fixture<Query[]>('search-queries.json');
const intended = fixture<Intended[]>('search-intended.json');

// 品質の下限。再現率は評価ハーネスの計測値 (1.000) のまま。
// P@10 は評価ハーネスで 0.987 だった。記事の増加で 2 文字区切りの語を別々に含む記事が増え、
// 部分文字列では一致しない結果が上位に入りうるため、0.98 を下限にする。
const BASELINE_PRECISION_AT_10 = 0.98;
const BASELINE_RECALL = 1;

const normalize = (s: string) => s.normalize('NFKC').toLowerCase();

const corpus = loadCorpus();
const { exec, inTransaction } = openMemoryDb();
inTransaction(() => replaceAll(exec, corpus));

const idOf = (slug: string, locale: Locale) => `${slug}:${locale}`;
/** 検索結果の記事 id (`<slug>:<locale>`) を関連度順に返す。件数の上限は外して全件を見る */
const searchIds = (q: string, locale: Locale) => search(exec, q, locale, 1000).map((h) => idOf(h.slug, locale));

function substringTruth(q: string, locale: Locale): Set<string> {
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  if (terms.length === 0) return out;
  for (const d of corpus.filter((x) => x.locale === locale)) {
    const text = normalize(`${d.title}\n${d.body}`);
    if (terms.every((t) => text.includes(t))) out.add(idOf(d.slug, locale));
  }
  return out;
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('サイト内検索の品質', () => {
  it('否定クエリ (存在しない語) は1件も返さない', () => {
    const negatives = queries.filter((q) => q.category.startsWith('negative'));
    assert.equal(negatives.length, 16);
    for (const { q, locale } of negatives) {
      assert.equal(substringTruth(q, locale).size, 0, `前提: 「${q}」は本文に存在しない`);
      assert.deepEqual(searchIds(q, locale), [], `「${q}」(${locale}) が偽ヒットした`);
    }
  });

  it('意図した記事がすべて上位3件に入る', () => {
    assert.equal(intended.length, 32);
    for (const { q, locale, ids } of intended) {
      const top3 = searchIds(q, locale).slice(0, 3);
      for (const id of ids)
        assert.ok(top3.includes(id), `「${q}」(${locale}) の上位3件に ${id} がない: ${top3.join(', ')}`);
    }
  });

  it('substring 正解に対する再現率と P@10 が下限を下回らない', () => {
    const precisions: number[] = [];
    const recalls: number[] = [];
    for (const { q, locale } of queries) {
      const truth = substringTruth(q, locale);
      if (truth.size === 0) continue;
      const returned = searchIds(q, locale);
      const top10 = returned.slice(0, 10);
      precisions.push(top10.length === 0 ? 0 : top10.filter((id) => truth.has(id)).length / top10.length);
      recalls.push(returned.filter((id) => truth.has(id)).length / truth.size);
    }
    assert.equal(precisions.length, 48);
    assert.ok(mean(recalls) >= BASELINE_RECALL, `再現率 ${mean(recalls)}`);
    assert.ok(mean(precisions) >= BASELINE_PRECISION_AT_10, `P@10 ${mean(precisions)}`);
  });
});

describe('検索結果の形', () => {
  const doc: IndexDoc = {
    slug: 'sample',
    locale: 'ja',
    title: 'サンプル記事 Angular',
    date: '2026-01-02',
    channels: ['Angular'],
    body: 'ここは前置きの文章です。'.repeat(20) + 'InjectAsync は遅延読み込みを行う。' + '末尾の文章です。'.repeat(20),
  };
  /** docs だけを入れた索引を作る */
  const indexOf = (docs: IndexDoc[]) => {
    const { exec: run, inTransaction: tx } = openMemoryDb();
    tx(() => replaceAll(run, docs));
    return run;
  };

  it('slug・題名・日付・チャンネル・抜粋を返す', () => {
    const [hit] = search(indexOf([doc]), '遅延読み込み', 'ja');
    assert.equal(hit.slug, 'sample');
    assert.equal(hit.title, 'サンプル記事 Angular');
    assert.equal(hit.date, '2026-01-02');
    assert.deepEqual(hit.channels, ['Angular']);
    assert.ok(hit.snippet.includes('遅延読み込み'), hit.snippet);
  });

  it('抜粋は本文の大文字小文字を保つ (3文字以上の語)', () => {
    const [hit] = search(indexOf([doc]), 'injectasync', 'ja');
    assert.ok(hit.snippet.includes('InjectAsync'), hit.snippet);
  });

  it('抜粋は本文の大文字小文字を保つ (3文字未満の語)', () => {
    const [hit] = search(indexOf([doc]), 'In', 'ja');
    assert.ok(hit.snippet.includes('InjectAsync'), hit.snippet);
  });

  it('3文字未満の語でも一致箇所の周辺を抜粋にする', () => {
    const [hit] = search(indexOf([doc]), 'は遅', 'ja');
    assert.ok(hit.snippet.includes('は遅'), hit.snippet);
  });

  it('抜粋に改行を含めない', () => {
    const [hit] = search(indexOf([{ ...doc, body: '一行目\n二行目の検索語を含む行\n三行目' }]), '検索語', 'ja');
    assert.ok(!hit.snippet.includes('\n'), hit.snippet);
  });

  it('結果は最大20件', () => {
    const run = indexOf(Array.from({ length: 30 }, (_, i) => ({ ...doc, slug: `s${i}` })));
    assert.equal(search(run, '遅延読み込み', 'ja').length, 20);
  });

  it('入れ替えると新しい記事だけが検索できる', () => {
    const { exec: run, inTransaction: tx } = openMemoryDb();
    tx(() => replaceAll(run, [doc]));
    tx(() => replaceAll(run, [{ ...doc, slug: 'other', body: '別の本文' }]));
    assert.deepEqual(search(run, '遅延読み込み', 'ja'), []);
    assert.equal(search(run, '別の本文', 'ja')[0].slug, 'other');
  });

  it('入れ替えが途中で失敗したら古い索引が残る', () => {
    const { exec: run, inTransaction: tx } = openMemoryDb();
    tx(() => replaceAll(run, [doc]));
    // channels が JSON にできない値 (BigInt) の記事で INSERT 前に例外を起こす
    const broken = { ...doc, slug: 'broken', channels: [1n] as unknown as string[] };
    assert.throws(() => tx(() => replaceAll(run, [broken])));
    assert.equal(search(run, '遅延読み込み', 'ja')[0].slug, 'sample');
  });
});

describe('抜粋と一致箇所', () => {
  const sentence = (i: number) => `これは${i}番目の説明文で、特に変わった内容はありません。`;
  const filler = (from: number, n: number) => Array.from({ length: n }, (_, i) => sentence(from + i)).join('');
  const base: IndexDoc = { slug: 'a', locale: 'ja', title: '題名', date: '2026-01-02', channels: [], body: '' };
  const hitOf = (body: string, q: string, title = '題名') => {
    const { exec: run, inTransaction: tx } = openMemoryDb();
    tx(() => replaceAll(run, [{ ...base, title, body }]));
    const [hit] = search(run, q, 'ja');
    assert.ok(hit, `「${q}」がヒットしない`);
    return hit;
  };
  /** 応答だけから、一致箇所の文字列を取り出す */
  const marked = (h: { snippet: string; highlights: [number, number][] }) =>
    h.highlights.map(([s, e]) => h.snippet.slice(s, e));

  it('3文字以上の語: 応答の一致範囲が、エンジンの一致判定 (語の出現) と同じ', () => {
    const hit = hitOf(`${filler(0, 10)}Preloading と loading の違い。${filler(10, 10)}`, 'loading');
    assert.deepEqual(marked(hit), ['loading', 'loading']);
  });

  it('3文字以上の語: 本文の大文字小文字を保ったまま範囲を返す', () => {
    const hit = hitOf(`${filler(0, 5)}InjectAsync は遅延読み込みを行う。${filler(5, 5)}`, 'injectasync');
    assert.deepEqual(marked(hit), ['InjectAsync']);
  });

  it('複数の語: 各語の出現だけが範囲になる', () => {
    const hit = hitOf('Angular と Signals の話。Angular は便利だ。', 'angular signals');
    assert.deepEqual(marked(hit), ['Angular', 'Signals', 'Angular']);
  });

  it('3文字未満の語のみ: 一致範囲を返す (大文字小文字は本文のまま)', () => {
    const hit = hitOf(`${filler(0, 10)}An ab AB と Ab、abc。${filler(10, 10)}`, 'ab');
    assert.deepEqual(marked(hit), ['ab', 'AB', 'Ab', 'ab']);
  });

  it('3文字未満の語のみ: 複数の語も範囲になる', () => {
    const hit = hitOf('xy と zw と xy', 'xy zw');
    assert.deepEqual(marked(hit), ['xy', 'zw', 'xy']);
  });

  it('3文字以上と3文字未満の語が混在しても、どちらの一致も範囲になる', () => {
    const hit = hitOf('Angular は ab と相性がよい', 'angular ab');
    assert.deepEqual(marked(hit), ['Angular', 'ab']);
  });

  it('一致範囲は昇順で重ならず、抜粋の範囲に収まる', () => {
    const hit = hitOf(`${filler(0, 8)}loading loading loading ${filler(8, 8)}`, 'loading');
    let prev = 0;
    for (const [s, e] of hit.highlights) {
      assert.ok(prev <= s && s < e && e <= hit.snippet.length, JSON.stringify(hit.highlights));
      prev = e;
    }
  });

  it('本文に一致が無い (題名だけの一致) ときは範囲が空で、本文の先頭を抜粋にする', () => {
    const hit = hitOf(filler(0, 10), '特別な題名', '特別な題名のサンプル');
    assert.deepEqual(hit.highlights, []);
    assert.ok(hit.snippet.startsWith('これは0番目'), hit.snippet);
  });

  it('本文の先頭と末尾に届く抜粋は省略記号を付けない', () => {
    const hit = hitOf('短い本文に loading がある。', 'loading');
    assert.equal(hit.snippet, '短い本文に loading がある。');
  });

  it('`<` と `&` を含む本文は、エスケープせず平文のまま返し、範囲は平文の位置を指す', () => {
    for (const q of ['loading', 'ab']) {
      const hit = hitOf('<b>タグ</b> & &amp; <script>x</script> loading ab <i>', q);
      assert.ok(hit.snippet.includes('</script> loading'), hit.snippet);
      assert.ok(hit.snippet.includes('<'), hit.snippet);
      assert.ok(!hit.snippet.includes('&lt;'), hit.snippet);
      assert.deepEqual(marked(hit), [q]);
    }
  });

  it('範囲は NFKC 正規化後の抜粋の位置を指す (全角の本文)', () => {
    const hit = hitOf('ＡＮＧＵＬＡＲ　ａｂ　ｌｏａｄｉｎｇ', 'angular loading ab');
    assert.equal(hit.snippet, 'ANGULAR ab loading');
    assert.deepEqual(marked(hit), ['ANGULAR', 'ab', 'loading']);
  });

  it('範囲は UTF-16 の位置で数える (サロゲートペアを含む本文)', () => {
    const hit = hitOf('😀😀 loading 😀 ab', 'loading ab');
    assert.deepEqual(marked(hit), ['loading', 'ab']);
  });

  it('改行を含む本文でも範囲がずれない', () => {
    const hit = hitOf('一行目\n\n  二行目の loading\n三行目 ab', 'loading ab');
    assert.ok(!hit.snippet.includes('\n'), hit.snippet);
    assert.deepEqual(marked(hit), ['loading', 'ab']);
  });

  it('内部で使う区切り文字を本文が含んでいても、一致範囲が壊れず応答に残らない', () => {
    const hit = hitOf('前\u0001中\u0002後 loading\u0001', 'loading');
    assert.deepEqual(marked(hit), ['loading']);
    assert.ok(!hit.snippet.includes('\u0001') && !hit.snippet.includes('\u0002'), JSON.stringify(hit.snippet));
  });

  it('抜粋は現状の約50文字より長く、FTS5 の snippet() の上限 (64 トークン) に収まる', () => {
    for (const q of ['loading', 'ab']) {
      const hit = hitOf(`${filler(0, 30)}loading と ab の話。${filler(30, 30)}`, q);
      // 64 トークン = 66 文字 (trigram) + 両端の省略記号
      assert.ok(hit.snippet.length > 60, `${hit.snippet.length}: ${hit.snippet}`);
      assert.ok(hit.snippet.length <= 68, `${hit.snippet.length}: ${hit.snippet}`);
    }
  });

  it('本文の途中から始まる抜粋と、途中で終わる抜粋には省略記号が付く (snippet() の標準の扱い)', () => {
    for (const q of ['loading', 'ab']) {
      const hit = hitOf(`${filler(0, 30)}loading と ab の話。${filler(30, 30)}`, q);
      assert.ok(hit.snippet.startsWith('…') && hit.snippet.endsWith('…'), hit.snippet);
    }
  });

  it('3文字以上の語の抜粋は、FTS5 の snippet() の結果そのものである', () => {
    const phrase = (t: string) => `"${t}"`;
    let checked = 0;
    for (const { q, locale } of positive) {
      const terms = normalize(q).split(/\s+/).filter(Boolean);
      if (terms.some((t) => [...t].length < 3)) continue;
      const rows = exec(
        `SELECT slug, snippet(fts_${locale}, 5, '', '', '…', 64) AS s FROM fts_${locale} WHERE fts_${locale} MATCH ?`,
        terms.map((t) => phrase(t.toLowerCase())).join(' AND '),
      );
      const engine = new Map(rows.map((r) => [String(r.slug), String(r.s).replace(/\s+/g, ' ').trim()]));
      for (const hit of search(exec, q, locale)) {
        assert.equal(hit.snippet, engine.get(hit.slug), `「${q}」の ${hit.slug}`);
        checked++;
      }
    }
    assert.ok(checked > 100, `${checked}`);
  });

  it('実記事: 抜粋は snippet() の上限に収まり、多くは現状の約50文字より長い', () => {
    const lengths: number[] = [];
    for (const { q, locale } of positive) for (const hit of search(exec, q, locale)) lengths.push(hit.snippet.length);
    assert.ok(Math.max(...lengths) <= 68, `${Math.max(...lengths)}`);
    assert.ok(mean(lengths) > 60, `平均 ${mean(lengths)}`);
  });

  it('JSON に直列化しても形が保たれる', () => {
    const hit = hitOf('<b>x</b> loading', 'loading');
    const round = JSON.parse(JSON.stringify(hit)) as typeof hit;
    assert.deepEqual(round.highlights, hit.highlights);
    assert.equal(round.snippet, hit.snippet);
  });

  const isConcatenationOf = (text: string, terms: string[]): boolean =>
    text === '' || terms.some((t) => text.startsWith(t) && isConcatenationOf(text.slice(t.length), terms));
  const positive = queries.filter((x) => !x.category.startsWith('negative'));

  it('実記事: すべての一致範囲が、検索語の出現と同じ文字列である', () => {
    let checked = 0;
    for (const { q, locale } of positive) {
      const terms = normalize(q).split(/\s+/).filter(Boolean);
      for (const hit of search(exec, q, locale)) {
        for (const [s, e] of hit.highlights) {
          const text = normalize(hit.snippet.slice(s, e));
          // 隣り合う一致 (例: changeDetection の change と Detection) は 1 つの範囲にまとまるので、語の連なりとして分解できればよい
          // snippet() の端で切れた一致 (例: oxc-parser の oxc-p) は、語の先頭か末尾の一部だけが範囲になる
          const atEdge = s <= 1 || e >= hit.snippet.length - 1;
          const folded = text.toLowerCase().replace(/\s+/g, '');
          assert.ok(
            isConcatenationOf(folded, terms) || (atEdge && terms.some((t) => t.includes(folded))),
            `「${q}」の範囲 ${JSON.stringify(text)} が語に一致しない`,
          );
          checked++;
        }
      }
    }
    assert.ok(checked > 100, `検査した範囲が少ない: ${checked}`);
  });

  it('実記事: 本文に一致がある結果は、必ず一致範囲を持つ', () => {
    const byId = new Map(corpus.map((d) => [idOf(d.slug, d.locale), d]));
    let checked = 0;
    for (const { q, locale } of positive) {
      const terms = normalize(q).split(/\s+/).filter(Boolean);
      for (const hit of search(exec, q, locale)) {
        const body = normalize(byId.get(idOf(hit.slug, locale))!.body);
        if (!terms.every((t) => body.includes(t))) continue;
        assert.ok(hit.highlights.length > 0, `「${q}」の ${hit.slug} に範囲がない`);
        checked++;
      }
    }
    assert.ok(checked > 100, `${checked}`);
  });
});

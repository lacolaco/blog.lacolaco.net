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

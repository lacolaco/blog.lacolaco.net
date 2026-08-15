import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  manifestKey,
  readManifest,
  writeManifest,
  planGeneration,
  assertNotTruncating,
  seedManifest,
} from './manifest.ts';
import type { OgImageTarget } from './discover.ts';

function target(slug: string, locale: 'ja' | 'en', hash: string): OgImageTarget {
  return {
    filePath: `/x/${slug}${locale === 'en' ? '.en' : ''}.md`,
    slug,
    locale,
    title: slug,
    publishedDate: new Date('2024-01-01T00:00:00.000Z'),
    fileName: `${slug}.${locale}.${hash}.png`,
  };
}

describe('manifestKey', () => {
  // ja と en は同じ slug を共有するため、slug だけではキーにならない
  test('slugとlocaleを組み合わせる', () => {
    assert.equal(manifestKey('my-post', 'ja'), 'my-post.ja');
    assert.notEqual(manifestKey('my-post', 'ja'), manifestKey('my-post', 'en'));
  });
});

describe('readManifest', () => {
  test('存在しないファイルは空のマニフェストとして扱う', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-manifest-'));
    assert.deepEqual(readManifest(join(dir, 'absent.json')), {});
    rmSync(dir, { recursive: true, force: true });
  });

  test('保存した内容をそのまま読み戻せる', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-manifest-'));
    const path = join(dir, 'og-manifest.json');
    const manifest = { 'my-post.ja': 'my-post.ja.aaaaaaaaaaaaaaaa.png' };
    writeManifest(path, manifest);

    assert.deepEqual(readManifest(path), manifest);
    rmSync(dir, { recursive: true, force: true });
  });

  // 差分が読みやすいよう安定した順序で書く
  test('キーをソートして書き出す', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-manifest-'));
    const path = join(dir, 'og-manifest.json');
    writeManifest(path, { 'b.ja': 'b.ja.x.png', 'a.ja': 'a.ja.x.png' });

    const written = readFileSync(path, 'utf8');
    assert.ok(written.indexOf('"a.ja"') < written.indexOf('"b.ja"'));
    rmSync(dir, { recursive: true, force: true });
  });

  // 書き込み途中でプロセスが終了しても壊れたJSONを残さない
  test('一時ファイルを残さない', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-manifest-'));
    const path = join(dir, 'og-manifest.json');
    writeManifest(path, { 'a.ja': 'a.ja.x.png' });

    assert.deepEqual(readdirSync(dir), ['og-manifest.json']);
    rmSync(dir, { recursive: true, force: true });
  });

  test('壊れたJSONはエラーになる', () => {
    const dir = mkdtempSync(join(tmpdir(), 'og-manifest-'));
    const path = join(dir, 'og-manifest.json');
    writeFileSync(path, '{ broken', 'utf8');

    assert.throws(() => readManifest(path));
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('assertNotTruncating', () => {
  // cwdの誤りやチェックアウトの不備で記事0件になると、マニフェストが空に切り詰められ
  // R2上の画像への参照を全て失う
  test('記事0件で既存エントリがあるとエラーになる', () => {
    assert.throws(() => assertNotTruncating(0, { 'my-post.ja': 'my-post.ja.x.png' }), /マニフェスト/);
  });

  test('記事0件でも既存エントリがなければ通る', () => {
    assert.doesNotThrow(() => assertNotTruncating(0, {}));
  });

  // 部分的なチェックアウト漏れは0件にならない。大幅に減る場合も止める
  test('既存の半数を下回るとエラーになる', () => {
    const previous = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`p${i}.ja`, `p${i}.ja.x.png`]));

    assert.throws(() => assertNotTruncating(2, previous), /マニフェスト/);
  });

  test('記事が増えている場合は通る', () => {
    const previous = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`p${i}.ja`, `p${i}.ja.x.png`]));

    assert.doesNotThrow(() => assertNotTruncating(120, previous));
  });

  // 記事の削除は正常な操作なので、緩やかな減少は止めない
  test('わずかな減少は通る', () => {
    const previous = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`p${i}.ja`, `p${i}.ja.x.png`]));

    assert.doesNotThrow(() => assertNotTruncating(98, previous));
  });
});

describe('seedManifest', () => {
  // 生成前に書き出す初期状態。中断しても開始前の状態を下回らないことが要件
  test('生成不要なエントリをそのまま含む', () => {
    const ja = target('kept', 'ja', 'aaaaaaaaaaaaaaaa');

    assert.deepEqual(seedManifest({ 'kept.ja': ja.fileName }, [], {}), { 'kept.ja': ja.fileName });
  });

  // R2上の旧オブジェクトは削除しないので、旧ファイル名は依然として有効
  test('再生成待ちのキーには旧ファイル名を残す', () => {
    const next = target('changed', 'ja', 'bbbbbbbbbbbbbbbb');
    const previous = { 'changed.ja': 'changed.ja.aaaaaaaaaaaaaaaa.png' };

    assert.deepEqual(seedManifest({}, [next], previous), previous);
  });

  test('新規記事は生成が終わるまで含めない', () => {
    const fresh = target('new-post', 'ja', 'aaaaaaaaaaaaaaaa');

    assert.deepEqual(seedManifest({}, [fresh], {}), {});
  });

  test('引き継ぎと旧エントリを併せて返す', () => {
    const kept = target('kept', 'ja', 'aaaaaaaaaaaaaaaa');
    const changed = target('changed', 'ja', 'bbbbbbbbbbbbbbbb');

    const seeded = seedManifest({ 'kept.ja': kept.fileName }, [changed], {
      'changed.ja': 'changed.ja.old.png',
    });

    assert.deepEqual(seeded, { 'kept.ja': kept.fileName, 'changed.ja': 'changed.ja.old.png' });
  });
});

describe('planGeneration', () => {
  test('マニフェストに一致する記事は生成しない', () => {
    const t = target('my-post', 'ja', 'aaaaaaaaaaaaaaaa');
    const plan = planGeneration([t], { 'my-post.ja': t.fileName });

    assert.equal(plan.toGenerate.length, 0);
  });

  test('マニフェストにない記事は生成する', () => {
    const t = target('my-post', 'ja', 'aaaaaaaaaaaaaaaa');
    const plan = planGeneration([t], {});

    assert.deepEqual(plan.toGenerate, [t]);
  });

  // hash が変われば別ファイルになるため、記事の変更もレンダラの変更もここで検出される
  test('マニフェストと異なるhashの記事は生成する', () => {
    const t = target('my-post', 'ja', 'bbbbbbbbbbbbbbbb');
    const plan = planGeneration([t], { 'my-post.ja': 'my-post.ja.aaaaaaaaaaaaaaaa.png' });

    assert.deepEqual(plan.toGenerate, [t]);
  });

  test('jaとenを独立して判定する', () => {
    const ja = target('my-post', 'ja', 'aaaaaaaaaaaaaaaa');
    const en = target('my-post', 'en', 'bbbbbbbbbbbbbbbb');
    const plan = planGeneration([ja, en], { 'my-post.ja': ja.fileName });

    assert.deepEqual(plan.toGenerate, [en]);
  });

  // 生成のたびにマニフェストを書けるよう、生成不要なエントリだけを分けて返す
  test('生成不要なエントリだけをcarryOverに入れる', () => {
    const ja = target('my-post', 'ja', 'aaaaaaaaaaaaaaaa');
    const en = target('other-post', 'en', 'bbbbbbbbbbbbbbbb');
    const plan = planGeneration([ja, en], { 'my-post.ja': ja.fileName });

    assert.deepEqual(plan.carryOver, { 'my-post.ja': ja.fileName });
    assert.deepEqual(plan.toGenerate, [en]);
  });

  // 記事が削除されたらマニフェストからも消える。R2上の画像は参照されなくなるだけで残す
  test('記事が存在しないエントリは引き継がない', () => {
    const ja = target('my-post', 'ja', 'aaaaaaaaaaaaaaaa');
    const plan = planGeneration([ja], {
      'my-post.ja': ja.fileName,
      'deleted-post.ja': 'deleted-post.ja.x.png',
    });

    assert.deepEqual(Object.keys(plan.carryOver), ['my-post.ja']);
  });

  // 黙って上書きすると、生成した画像の片方が参照されないまま残る
  test('slugとlocaleが重複するとエラーになる', () => {
    const a = target('my-post', 'ja', 'aaaaaaaaaaaaaaaa');
    const b = { ...target('my-post', 'ja', 'bbbbbbbbbbbbbbbb'), filePath: '/x/duplicate.md' };

    assert.throws(() => planGeneration([a, b], {}), /重複/);
  });
});

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { extractCode, restoreCode } from './code-extractor.ts';

describe('extractCode', () => {
  test('コードブロックを ⟨⟨BLOCK_N⟩⟩ に置換する', () => {
    const md = 'before\n\n```ts\nconst a = 1;\n```\n\nafter\n';
    const { template, codeBlocks, inlineCodes } = extractCode(md);
    assert.equal(codeBlocks.length, 1);
    assert.equal(inlineCodes.length, 0);
    assert.match(template, /⟨⟨BLOCK_0⟩⟩/);
    assert.match(template, /^before/);
    assert.match(template, /after\n$/);
    assert.equal(codeBlocks[0], '```ts\nconst a = 1;\n```');
  });

  test('インラインコードを ⟨⟨INLINE_N⟩⟩ に置換する', () => {
    const md = 'use `foo` and `bar` here\n';
    const { template, inlineCodes } = extractCode(md);
    assert.equal(inlineCodes.length, 2);
    assert.equal(template, 'use ⟨⟨INLINE_0⟩⟩ and ⟨⟨INLINE_1⟩⟩ here\n');
    assert.equal(inlineCodes[0], '`foo`');
    assert.equal(inlineCodes[1], '`bar`');
  });

  test('コードブロック・インラインコードが混在', () => {
    const md = 'use `foo`\n\n```\ncode\n```\n\nthen `bar`\n';
    const { template, codeBlocks, inlineCodes } = extractCode(md);
    assert.equal(codeBlocks.length, 1);
    assert.equal(inlineCodes.length, 2);
    assert.match(template, /⟨⟨INLINE_0⟩⟩/);
    assert.match(template, /⟨⟨BLOCK_0⟩⟩/);
    assert.match(template, /⟨⟨INLINE_1⟩⟩/);
  });

  test('複数コードブロックは順番に番号付け', () => {
    const md = '```\nA\n```\n\ntext\n\n```\nB\n```\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 2);
    assert.equal(codeBlocks[0], '```\nA\n```');
    assert.equal(codeBlocks[1], '```\nB\n```');
    assert.match(template, /⟨⟨BLOCK_0⟩⟩[\s\S]*⟨⟨BLOCK_1⟩⟩/);
  });

  test('コードがないと codeBlocks/inlineCodes は空、template は元と同じ', () => {
    const md = 'plain prose\n';
    const { template, codeBlocks, inlineCodes } = extractCode(md);
    assert.equal(codeBlocks.length, 0);
    assert.equal(inlineCodes.length, 0);
    assert.equal(template, md);
  });

  test('言語タグ付きコードブロックの fence (```ts) を保持', () => {
    const md = '```typescript\nconst x = 1;\n```\n';
    const { codeBlocks } = extractCode(md);
    assert.equal(codeBlocks[0], '```typescript\nconst x = 1;\n```');
  });

  test('コードブロック内の引用符・特殊文字をそのまま保持', () => {
    const md = '```html\n<img src="x” />\n```\n';
    const { codeBlocks } = extractCode(md);
    assert.equal(codeBlocks[0], '```html\n<img src="x” />\n```');
  });
});

describe('restoreCode', () => {
  test('プレースホルダを元の code で置換する', () => {
    const template = 'use ⟨⟨INLINE_0⟩⟩\n\n⟨⟨BLOCK_0⟩⟩\n';
    const result = restoreCode(template, ['```\nA\n```'], ['`foo`']);
    assert.equal(result, 'use `foo`\n\n```\nA\n```\n');
  });

  test('複数プレースホルダを順番通りに置換', () => {
    const template = '⟨⟨INLINE_0⟩⟩ and ⟨⟨INLINE_1⟩⟩';
    const result = restoreCode(template, [], ['`a`', '`b`']);
    assert.equal(result, '`a` and `b`');
  });

  test('extractCode → restoreCode が round-trip で元に戻る', () => {
    const md = 'use `foo` and `bar`\n\n```ts\nconst a = 1;\n```\n\nthen ```inline``` ?\n';
    const { template, codeBlocks, inlineCodes } = extractCode(md);
    const restored = restoreCode(template, codeBlocks, inlineCodes);
    assert.equal(restored, md);
  });

  test('プレースホルダが残っていたら throw（LLM が消失させた場合の検知）', () => {
    const template = '⟨⟨INLINE_0⟩⟩'; // INLINE_0 だけだが inlineCodes には 2 個
    assert.throws(() => restoreCode(template, [], ['`a`', '`b`']), /placeholder/i);
  });

  test('テンプレートに余分なプレースホルダがあれば throw（LLM が幻覚した場合の検知）', () => {
    const template = '⟨⟨INLINE_0⟩⟩ ⟨⟨INLINE_5⟩⟩'; // INLINE_5 はそもそも extract されていない
    assert.throws(() => restoreCode(template, [], ['`a`']), /placeholder/i);
  });

  test('プレースホルダが重複していたら throw（LLM が duplicate した場合の検知）', () => {
    // テンプレート内で ⟨⟨BLOCK_0⟩⟩ が 2 回出現 → コード重複挿入のリスク
    const template = '⟨⟨BLOCK_0⟩⟩\n\n再掲: ⟨⟨BLOCK_0⟩⟩';
    assert.throws(() => restoreCode(template, ['```\nA\n```'], []), /appears 2 times/i);
  });

  test('コードブロックの内容にプレースホルダ風の文字列が含まれても誤検知しない', () => {
    // このシステム自体を解説する記事のように、コード内に ⟨⟨BLOCK_N⟩⟩ という文字列が
    // 含まれる場合がある。restoreCode 後の result でプレースホルダパターンを検査すると
    // 誤って throw してしまうため、このケースで正常に復元できることを保証する
    const template = '解説: ⟨⟨BLOCK_0⟩⟩';
    const codeWithPlaceholderText = '```ts\n// プレースホルダ ⟨⟨BLOCK_1⟩⟩ について\n```';
    const result = restoreCode(template, [codeWithPlaceholderText], []);
    assert.equal(result, '解説: ' + codeWithPlaceholderText);
  });
});

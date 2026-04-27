import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { extractCode, restoreCode } from './code-extractor.ts';

describe('extractCode', () => {
  test('コードブロックを ⟨⟨BLOCK_N⟩⟩ に置換する', () => {
    const md = 'before\n\n```ts\nconst a = 1;\n```\n\nafter\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 1);
    assert.match(template, /⟨⟨BLOCK_0⟩⟩/);
    assert.match(template, /^before/);
    assert.match(template, /after\n$/);
    assert.equal(codeBlocks[0], '```ts\nconst a = 1;\n```');
  });

  test('インラインコードは抽出対象外（ja→en では既に英語/コードなので翻訳されない）', () => {
    // ja → en 翻訳では inline code (`Signal` 等) は既に target language。
    // placeholder 化すると ja-en 語順差を「LLM の swap」と誤検出する原因になるため、
    // inline は template にそのまま残し LLM に渡す。LLM は backtick 識別子を保持する想定
    const md = 'use `foo` and `bar` here\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 0);
    assert.equal(template, 'use `foo` and `bar` here\n');
  });

  test('コードブロックは抽出する、インラインはそのまま残す', () => {
    const md = 'use `foo`\n\n```\ncode\n```\n\nthen `bar`\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 1);
    assert.match(template, /use `foo`/);
    assert.match(template, /⟨⟨BLOCK_0⟩⟩/);
    assert.match(template, /then `bar`/);
  });

  test('複数コードブロックは順番に番号付け', () => {
    const md = '```\nA\n```\n\ntext\n\n```\nB\n```\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 2);
    assert.equal(codeBlocks[0], '```\nA\n```');
    assert.equal(codeBlocks[1], '```\nB\n```');
    assert.match(template, /⟨⟨BLOCK_0⟩⟩[\s\S]*⟨⟨BLOCK_1⟩⟩/);
  });

  test('コードがないと codeBlocks は空、template は元と同じ', () => {
    const md = 'plain prose\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 0);
    assert.equal(template, md);
  });

  test('言語タグ付きコードブロックの fence (```ts) を保持', () => {
    const md = '```typescript\nconst x = 1;\n```\n';
    const { codeBlocks } = extractCode(md);
    assert.equal(codeBlocks[0], '```typescript\nconst x = 1;\n```');
  });

  test('チルダフェンス (~~~) でも抽出と round-trip が成立する', () => {
    const md = 'before\n\n~~~ts\nconst x = 1;\n~~~\n\nafter\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 1);
    assert.equal(codeBlocks[0], '~~~ts\nconst x = 1;\n~~~');
    assert.match(template, /⟨⟨BLOCK_0⟩⟩/);
    // round-trip
    assert.equal(restoreCode(template, codeBlocks), md);
  });

  test('コードブロック内の引用符・特殊文字をそのまま保持', () => {
    const md = '```html\n<img src="x” />\n```\n';
    const { codeBlocks } = extractCode(md);
    assert.equal(codeBlocks[0], '```html\n<img src="x” />\n```');
  });

  test('blockquote 内のコードブロックは抽出対象外（template にそのまま残る、round-trip OK）', () => {
    // remark は blockquote 内 code の position を `> ` プレフィックス混在の範囲として返すため、
    // プレースホルダ化すると下流の translateCodeBlock の fence 検証が壊れて silent failure になる。
    // よって code-extractor は blockquote 内 code を抽出対象外にし、template に残して LLM の prose 翻訳に委ねる
    const md = '前置き\n\n> ```ts\n> const x = 1;\n> ```\n\n後置き\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 0);
    assert.equal(template, md);
    // 念のため round-trip も確認
    assert.equal(restoreCode(template, codeBlocks), md);
  });

  test('blockquote 内のインラインコードも抽出対象外', () => {
    const md = '> 引用文中の `foo` という識別子\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 0);
    assert.equal(template, md);
  });

  test('prose 中にプレースホルダ風文字列があっても衝突しない（escape による退避）', () => {
    // このシステム自体を解説する記事を想定: prose 中で「⟨⟨BLOCK_0⟩⟩」を文字列として参照
    const md = '解説: ⟨⟨BLOCK_0⟩⟩ という記法を使う。\n\n```ts\nconst x = 1;\n```\n';
    const { template, codeBlocks } = extractCode(md);
    // template には実際のプレースホルダだけが exactly 1 回だけ出現する
    assert.equal(codeBlocks.length, 1);
    // round-trip で元に戻る
    const restored = restoreCode(template, codeBlocks);
    assert.equal(restored, md);
  });

  test('escape 文字 ⟪⟪ または ⟫⟫ が markdown に既に含まれていたら throw（silent corruption 防止）', () => {
    const mdWithReserved = 'text ⟪⟪ marker\n\n```\nfoo\n```\n';
    assert.throws(() => extractCode(mdWithReserved), /reserved escape sequence/);
  });

  test('blockquote 外の code と blockquote 内 code が混在 → 外側のみ抽出される', () => {
    const md = '```ts\nconst a = 1;\n```\n\n> ```ts\n> const b = 2;\n> ```\n';
    const { template, codeBlocks } = extractCode(md);
    assert.equal(codeBlocks.length, 1);
    assert.equal(codeBlocks[0], '```ts\nconst a = 1;\n```');
    // template に blockquote 内のコードはそのまま残る
    assert.match(template, /> ```ts\n> const b = 2;\n> ```/);
  });
});

describe('restoreCode', () => {
  test('BLOCK プレースホルダを元の code で置換する', () => {
    const template = 'use `foo`\n\n⟨⟨BLOCK_0⟩⟩\n';
    const result = restoreCode(template, ['```\nA\n```']);
    assert.equal(result, 'use `foo`\n\n```\nA\n```\n');
  });

  test('extractCode → restoreCode が round-trip で元に戻る', () => {
    const md = 'use `foo` and `bar`\n\n```ts\nconst a = 1;\n```\n\nthen `inline` ?\n';
    const { template, codeBlocks } = extractCode(md);
    const restored = restoreCode(template, codeBlocks);
    assert.equal(restored, md);
  });

  test('プレースホルダが消失していたら throw（LLM が drop した場合の検知）', () => {
    // codeBlocks は 2 個だが template には BLOCK_0 しかない
    const template = '⟨⟨BLOCK_0⟩⟩';
    assert.throws(() => restoreCode(template, ['```\nA\n```', '```\nB\n```']), /missing/i);
  });

  test('テンプレートに extract されていない番号のプレースホルダがあれば throw（LLM 幻覚）', () => {
    // BLOCK_5 は extract されていない。順序チェックが先に走るため order mismatch で reject される
    const template = '⟨⟨BLOCK_0⟩⟩ ⟨⟨BLOCK_5⟩⟩';
    assert.throws(() => restoreCode(template, ['```\nA\n```']), /placeholder/i);
  });

  test('プレースホルダの順序が入れ替わっていたら throw（block code の論理順序保護）', () => {
    // template 内で BLOCK_1 が BLOCK_0 より先に現れる順序入れ替え。
    // block code の段落順序が swap = 記事の論理構造の破壊なので reject する
    // (inline と異なり block は文中での自由な reorder が起きないため)
    const template = '前置き ⟨⟨BLOCK_1⟩⟩\n\n後置き ⟨⟨BLOCK_0⟩⟩';
    assert.throws(() => restoreCode(template, ['```\nA\n```', '```\nB\n```']), /placeholder order mismatch/i);
  });

  test('プレースホルダが重複していたら throw（LLM duplicate 検知）', () => {
    const template = '⟨⟨BLOCK_0⟩⟩\n\n再掲: ⟨⟨BLOCK_0⟩⟩';
    assert.throws(() => restoreCode(template, ['```\nA\n```']), /appears 2 times/i);
  });

  test('コードブロックの内容にプレースホルダ風の文字列が含まれても誤検知しない', () => {
    // このシステム自体を解説する記事のように、コード内に ⟨⟨BLOCK_N⟩⟩ という文字列が
    // 含まれる場合がある。restoreCode 後の result でプレースホルダパターンを検査すると
    // 誤って throw してしまうため、このケースで正常に復元できることを保証する
    const template = '解説: ⟨⟨BLOCK_0⟩⟩';
    const codeWithPlaceholderText = '```ts\n// プレースホルダ ⟨⟨BLOCK_1⟩⟩ について\n```';
    const result = restoreCode(template, [codeWithPlaceholderText]);
    assert.equal(result, '解説: ' + codeWithPlaceholderText);
  });
});

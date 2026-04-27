import { strict as assert } from 'node:assert';
import { test, describe, mock } from 'node:test';
import { translateCodeBlock, hasTranslatableComment, type CodeTranslatorClient } from './code-translator.ts';

const MODEL = 'test-model';

describe('hasTranslatableComment', () => {
  test('// 行コメント検出', () => {
    assert.equal(hasTranslatableComment('```ts\n// 注釈\nconst x = 1;\n```'), true);
  });

  test('# 行コメント検出', () => {
    assert.equal(hasTranslatableComment('```python\n# 説明\nx = 1\n```'), true);
  });

  test('# とコメント本文の間にスペースがなくても検出（#コメント スタイル）', () => {
    assert.equal(hasTranslatableComment('```python\n#日本語コメント\nx = 1\n```'), true);
  });

  test('shebang 行 (#!) は翻訳対象として検出しない', () => {
    assert.equal(hasTranslatableComment('```bash\n#!/usr/bin/env bash\necho hello\n```'), false);
  });

  test('/* ... */ ブロックコメント検出', () => {
    assert.equal(hasTranslatableComment('```ts\n/* 説明 */\nconst x = 1;\n```'), true);
  });

  test('<!-- ... --> HTML コメント検出', () => {
    assert.equal(hasTranslatableComment('```html\n<!-- 説明 -->\n<div></div>\n```'), true);
  });

  test('コメントなし → false', () => {
    assert.equal(hasTranslatableComment('```ts\nconst x = 1;\n```'), false);
  });

  test('// だけで本文なし → false', () => {
    assert.equal(hasTranslatableComment('```ts\n//\nconst x = 1;\n```'), false);
  });

  test('英数字のみのコメント → false（翻訳不要）', () => {
    assert.equal(hasTranslatableComment('```ts\n// TODO\nconst x = 1;\n```'), false);
  });

  test('英文コメントも → false（既に英語なので翻訳不要、API コスト削減）', () => {
    assert.equal(hasTranslatableComment('```ts\n// returns the user object\nconst x = 1;\n```'), false);
  });

  test('日本語コメント → true', () => {
    assert.equal(hasTranslatableComment('```ts\n// これは日本語コメントです\n```'), true);
  });

  test('英文の複数行ブロックコメント /* ... */ → false（改行で誤検出しない）', () => {
    const code = '```ts\n/* multiline\n   english only comment */\nconst x = 1;\n```';
    assert.equal(hasTranslatableComment(code), false);
  });

  test('英文の複数行 HTML コメント <!-- ... --> → false', () => {
    const code = '```html\n<!-- multi\n  line comment -->\n<div></div>\n```';
    assert.equal(hasTranslatableComment(code), false);
  });

  test('日本語を含む複数行ブロックコメント → true', () => {
    const code = '```ts\n/* multiline\n   日本語含む\n   comment */\nconst x = 1;\n```';
    assert.equal(hasTranslatableComment(code), true);
  });

  test('URL 文字列リテラル内の // は誤検出しない', () => {
    // `://` の // をコメントマーカーとして検出すると、URL パス内の非 ASCII 文字を
    // 翻訳対象として API を呼んでしまう偽陽性が発生する
    const code = '```ts\nconst url = "https://example.com/日本語";\n```';
    assert.equal(hasTranslatableComment(code), false);
  });

  test('URL の後にコメントが続く場合は検出する', () => {
    // 行末に // コメントが付く場合、URL の // と区別する必要がある
    const code = '```ts\nconst url = "https://example.com"; // 日本語コメント\n```';
    assert.equal(hasTranslatableComment(code), true);
  });
});

describe('translateCodeBlock', () => {
  test('コメントなしブロック → API 呼ばずそのまま返す', async () => {
    const code = '```ts\nconst x = 1;\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(code));
    const result = await translateCodeBlock({ code, client, model: MODEL });
    assert.equal(result, code);
    assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
  });

  test('コメントあり + LLM が translated を返す → translated を採用', async () => {
    const original = '```ts\n// 元のコメント\nconst x = 1;\n```';
    const translated = '```ts\n// translated comment\nconst x = 1;\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(translated));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, translated);
    assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
  });

  test('LLM の出力が行数不一致 → 原文に fallback', async () => {
    const original = '```ts\n// 元のコメント\nconst x = 1;\n```';
    // LLM が行数を変えた（壊れた出力）
    const broken = '```ts\nconst x = 1;\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(broken));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, original);
  });

  test('LLM throw → 原文に fallback（fail-safe）', async () => {
    const original = '```ts\n// 元のコメント\nconst x = 1;\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.reject(new Error('API error')));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, original);
  });

  test('fence 構造（```ts ... ```）が壊れたら原文に fallback', async () => {
    const original = '```ts\n// コメント\nconst x = 1;\n```';
    // LLM が fence を壊した
    const broken = '// コメント\nconst x = 1;\n';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(broken));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, original);
  });

  test('LLM が fence の言語タグを書き換えた場合は原文に fallback', async () => {
    const original = '```ts\n// 日本語コメント\nconst x = 1;\n```';
    // 言語タグが ts → javascript に変わった
    const tampered = '```javascript\n// translated comment\nconst x = 1;\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(tampered));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, original);
  });

  test('LLM がコメント以外（識別子）を改変した場合は原文に fallback', async () => {
    // 行数・fence・言語タグは保たれるが、識別子 foo → bar に変更
    const original = '```ts\n// 元コメント\nconst foo = 1;\n```';
    const tampered = '```ts\n// translated\nconst bar = 1;\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(tampered));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, original);
  });

  test('LLM が文字列リテラルを改変した場合は原文に fallback', async () => {
    const original = '```ts\n// 元コメント\nconst x = "hello";\n```';
    const tampered = '```ts\n// translated\nconst x = "world";\n```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(tampered));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    assert.equal(result, original);
  });

  test('リスト項目内のインデント付きコードブロックでも fence intact 判定が動作する', async () => {
    // remark は list item 内コードの position offset でインデント先頭から始まる範囲を返すため、
    // markdown.slice() の結果は各行の先頭が "  ```ts" のようなインデント付きになる。
    // fenceLines が空白を許容しないと isCodeFenceIntact が false → コメント翻訳がスキップされる
    const original = '  ```ts\n  // 日本語コメント\n  const x = 1;\n  ```';
    const translated = '  ```ts\n  // translated comment\n  const x = 1;\n  ```';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(translated));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    // 原文 fallback ではなく translated が採用されることを確認
    assert.equal(result, translated);
  });

  test('チルダフェンス (~~~) の翻訳でも fence intact 判定が正しく動作する', async () => {
    const original = '~~~ts\n// 日本語コメント\nconst x = 1;\n~~~';
    const translated = '~~~ts\n// translated comment\nconst x = 1;\n~~~';
    const client: CodeTranslatorClient = mock.fn(() => Promise.resolve(translated));
    const result = await translateCodeBlock({ code: original, client, model: MODEL });
    // チルダフェンスもバッククォートフェンスと同等に扱われ、誤って原文 fallback しないこと
    assert.equal(result, translated);
  });
});

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
});

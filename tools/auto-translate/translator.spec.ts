import { strict as assert } from 'node:assert';
import { test, describe, mock } from 'node:test';
import {
  computeBodyHash,
  translateOne,
  joinFrontmatter,
  PROMPT_VERSION,
  type GeminiClient,
  type TranslateOneArgs,
} from './translator.ts';
import { buildEnFrontmatter } from './frontmatter.ts';

const MODEL = 'test-model';

const JA_CONTENT_BASIC = `---
title: 'タイトル'
slug: 'sample'
locale: 'ja'
auto_translate: true
created_time: '2025-01-01T00:00:00.000Z'
last_edited_time: '2025-01-02T00:00:00.000Z'
tags: []
published: true
---

本文1段落目。

\`\`\`ts
const a = 1;
\`\`\`

https://example.com
`;

const TRANSLATED_BODY_OK = `Paragraph 1.

\`\`\`ts
const a = 1;
\`\`\`

https://example.com
`;

const TRANSLATED_BODY_BROKEN = `Paragraph 1 with code: const a = 1; included.

https://example.com
`;

function buildJaContent(overrides: { title?: string; body?: string; auto_translate?: boolean } = {}): string {
  const title = overrides.title ?? 'タイトル';
  const body = overrides.body ?? '本文1段落目。\n\n```ts\nconst a = 1;\n```\n\nhttps://example.com\n';
  const autoTranslate = overrides.auto_translate ?? true;
  return `---
title: '${title}'
slug: 'sample'
locale: 'ja'
auto_translate: ${autoTranslate}
created_time: '2025-01-01T00:00:00.000Z'
last_edited_time: '2025-01-02T00:00:00.000Z'
tags: []
published: true
---

${body}`;
}

function buildEnContent(bodyHash: string, body = TRANSLATED_BODY_OK, extraFm: Record<string, unknown> = {}): string {
  const fm = buildEnFrontmatter({
    jaFrontmatter: {
      title: 'タイトル',
      slug: 'sample',
      locale: 'ja',
      auto_translate: true,
      created_time: '2025-01-01T00:00:00.000Z',
      last_edited_time: '2025-01-02T00:00:00.000Z',
      tags: [],
      published: true,
      ...extraFm,
    },
    translatedTitle: 'Title',
    bodyHash,
  });
  return joinFrontmatter(fm, body);
}

function makeOkClient(output = { title_en: 'Title', body_en: TRANSLATED_BODY_OK }): GeminiClient {
  return mock.fn(() => Promise.resolve(output));
}

describe('computeBodyHash', () => {
  test('同じ入力なら同じハッシュ', () => {
    const a = computeBodyHash('body', 'title', MODEL);
    const b = computeBodyHash('body', 'title', MODEL);
    assert.equal(a, b);
  });

  test('body 変更でハッシュ変化', () => {
    const a = computeBodyHash('body1', 'title', MODEL);
    const b = computeBodyHash('body2', 'title', MODEL);
    assert.notEqual(a, b);
  });

  test('title 変更でハッシュ変化', () => {
    const a = computeBodyHash('body', 'title1', MODEL);
    const b = computeBodyHash('body', 'title2', MODEL);
    assert.notEqual(a, b);
  });

  test('model 変更でハッシュ変化', () => {
    const a = computeBodyHash('body', 'title', 'model1');
    const b = computeBodyHash('body', 'title', 'model2');
    assert.notEqual(a, b);
  });

  test('PROMPT_VERSION は定数として export されている', () => {
    assert.equal(typeof PROMPT_VERSION, 'number');
    assert.ok(Number.isInteger(PROMPT_VERSION));
  });

  test('hex 64 文字（sha256）', () => {
    const h = computeBodyHash('body', 'title', MODEL);
    assert.match(h, /^[0-9a-f]{64}$/);
  });
});

describe('translateOne', () => {
  function makeArgs(overrides: Partial<TranslateOneArgs> = {}): TranslateOneArgs {
    return {
      jaPath: '/x/sample.md',
      enPath: '/x/sample.en.md',
      jaContent: JA_CONTENT_BASIC,
      enContent: null,
      geminiClient: makeOkClient(),
      model: MODEL,
      ...overrides,
    };
  }

  describe('キャッシュ判定', () => {
    test('en 未存在 → API 呼んで全体書き出し', async () => {
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('body_hash 一致 + frontmatter コピー結果も同一 → API 呼ばず skip', async () => {
      const ja = buildJaContent();
      const jaBody = ja.split(/^---\n.*?\n---\n\n/s)[1];
      const hash = computeBodyHash(jaBody, 'タイトル', MODEL);
      const en = buildEnContent(hash);
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: ja, enContent: en, geminiClient: client }));
      assert.equal(result.kind, 'skipped');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
    });

    test('body_hash 不一致 → API 呼ぶ', async () => {
      const ja = buildJaContent({ body: '違う本文\n\n```ts\nconst a=1;\n```\n\nhttps://example.com\n' });
      const en = buildEnContent('different-hash-' + 'a'.repeat(50));
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: ja, enContent: en, geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('body_hash 一致 + ja の tags 変更 → API 呼ばず frontmatter のみ更新', async () => {
      const ja = buildJaContent();
      const jaBody = ja.split(/^---\n.*?\n---\n\n/s)[1];
      const hash = computeBodyHash(jaBody, 'タイトル', MODEL);
      // 既存 en は古い tags を持つ
      const en = buildEnContent(hash, TRANSLATED_BODY_OK, { tags: ['old-tag'] });
      // ja を tags 変更したものに差し替え
      const jaWithNewTags = ja.replace('tags: []', "tags: ['new-tag']");
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: jaWithNewTags, enContent: en, geminiClient: client }));
      assert.equal(result.kind, 'frontmatter-only');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
      assert.ok('enContent' in result && result.enContent.includes('new-tag'));
    });
  });

  describe('構造検証とリトライ', () => {
    test('1 回目 OK → そのまま採用、API 呼び出し 1 回', async () => {
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('1 回目 NG → 2 回目 OK → 採用、API 呼び出し 2 回', async () => {
      let count = 0;
      const client: GeminiClient = mock.fn(() => {
        count++;
        if (count === 1) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK });
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 2);
    });

    test('4 試行全て NG → failed、API 呼び出し 4 回', async () => {
      const client: GeminiClient = mock.fn(() =>
        Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN }),
      );
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'failed');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 4);
    });

    test('リトライ時のフィードバックメッセージに差分情報が含まれる', async () => {
      const calls: { feedback?: string }[] = [];
      let count = 0;
      const client: GeminiClient = mock.fn((input) => {
        calls.push({ feedback: input.feedback });
        count++;
        if (count === 1) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK });
      });
      await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(calls[0].feedback, undefined);
      const feedback = calls[1].feedback;
      assert.ok(feedback);
      assert.match(feedback, /code/i);
    });
  });

  describe('エラーハンドリング', () => {
    test('API throw → failed、既存温存', async () => {
      const client: GeminiClient = mock.fn(() => Promise.reject(new Error('network error')));
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'failed');
    });
  });
});

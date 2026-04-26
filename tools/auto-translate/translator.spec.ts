import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { test, describe, mock } from 'node:test';
import {
  computeBodyHash,
  translateOne,
  joinFrontmatter,
  splitFrontmatter,
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
  // テンプレート文字列で YAML を組み立てるとシングルクォート入りタイトル等で
  // 不正な YAML になるため、joinFrontmatter で正しくエスケープする
  return joinFrontmatter(
    {
      title,
      slug: 'sample',
      locale: 'ja',
      auto_translate: autoTranslate,
      created_time: '2025-01-01T00:00:00.000Z',
      last_edited_time: '2025-01-02T00:00:00.000Z',
      tags: [],
      published: true,
    },
    body,
  );
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

describe('splitFrontmatter / joinFrontmatter', () => {
  test('frontmatter と本文を分離する', () => {
    const content = `---\ntitle: 'X'\nslug: 'y'\n---\n\nbody text\n`;
    const { frontmatter, body } = splitFrontmatter(content);
    assert.equal(frontmatter.title, 'X');
    assert.equal(frontmatter.slug, 'y');
    assert.equal(body, 'body text\n');
  });

  test('frontmatter なしは throw', () => {
    assert.throws(() => splitFrontmatter('no frontmatter\n'));
  });

  test('joinFrontmatter は ---\\n で囲んだ YAML + 空行 + 本文を返す', () => {
    const result = joinFrontmatter({ title: 'X', slug: 'y' }, 'body text\n');
    assert.match(result, /^---\n[\s\S]+\n---\n\nbody text\n$/);
  });

  test('round-trip: split → join で frontmatter / body が保持される', () => {
    const original = joinFrontmatter(
      { title: 'タイトル', slug: 'slug', tags: ['a', 'b'], published: true },
      'body content\n\n## section\n\ntext\n',
    );
    const { frontmatter, body } = splitFrontmatter(original);
    const round = joinFrontmatter(frontmatter, body);
    assert.equal(round, original);
  });

  test('round-trip: 引用符を含むタイトルでも壊れない', () => {
    const original = joinFrontmatter({ title: "It's a 'test'" }, 'body\n');
    const { frontmatter } = splitFrontmatter(original);
    assert.equal(frontmatter.title, "It's a 'test'");
    const round = joinFrontmatter(frontmatter, splitFrontmatter(original).body);
    assert.equal(round, original);
  });

  test('round-trip: 空ボディでも壊れない', () => {
    const original = joinFrontmatter({ title: 'X' }, '');
    const { frontmatter, body } = splitFrontmatter(original);
    assert.equal(body, '');
    const round = joinFrontmatter(frontmatter, body);
    assert.equal(round, original);
  });

  test('round-trip: ネストオブジェクト（features）でも保持される', () => {
    const original = joinFrontmatter({ title: 'X', features: { katex: false, mermaid: true, tweet: false } }, 'body\n');
    const { frontmatter, body } = splitFrontmatter(original);
    const round = joinFrontmatter(frontmatter, body);
    assert.equal(round, original);
  });
});

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

  test('PROMPT_VERSION 変更でハッシュが変化することの間接検証', () => {
    // PROMPT_VERSION はモジュール定数のため差し替え困難。computeBodyHash の input 構造を再現実装で検証する。
    // 仕様: input = [body, title, String(version), model].join('\x00')
    const reproduce = (body: string, title: string, version: number, model: string): string =>
      createHash('sha256')
        .update([body, title, String(version), model].join('\x00'))
        .digest('hex');
    const actual = computeBodyHash('body', 'title', MODEL);
    const sameVersion = reproduce('body', 'title', PROMPT_VERSION, MODEL);
    const otherVersion = reproduce('body', 'title', PROMPT_VERSION + 1, MODEL);
    assert.equal(actual, sameVersion);
    assert.notEqual(sameVersion, otherVersion);
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
      const { body: jaBody } = splitFrontmatter(ja);
      const hash = computeBodyHash(jaBody, 'タイトル', MODEL);
      const en = buildEnContent(hash);
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: ja, enContent: en, geminiClient: client }));
      assert.equal(result.kind, 'skipped');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
    });

    test('body_hash 不一致 → API 呼ぶ', async () => {
      // ja body は元と異なるが、コード内容は翻訳結果（TRANSLATED_BODY_OK）と一致させる必要がある
      const ja = buildJaContent({ body: '違う本文\n\n```ts\nconst a = 1;\n```\n\nhttps://example.com\n' });
      const en = buildEnContent('different-hash-' + 'a'.repeat(50));
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: ja, enContent: en, geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('body_hash 一致 + ja の tags 変更 → API 呼ばず frontmatter のみ更新', async () => {
      const ja = buildJaContent();
      const { body: jaBody } = splitFrontmatter(ja);
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

    test('2 回連続 NG → 3 回目 OK → 採用、API 呼び出し 3 回', async () => {
      let count = 0;
      const client: GeminiClient = mock.fn(() => {
        count++;
        if (count <= 2) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK });
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 3);
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

    test('codeBlockContent 不一致時、フィードバックに detail（具体的な差分内容）が含まれる', async () => {
      const calls: { feedback?: string }[] = [];
      const jaWithCode = buildJaContent({ body: '本文\n\n```\nfoo\n```\n' });
      // ターゲットはコード数同数だが内容が違う → codeBlockContent ミスマッチ
      const brokenWithDifferentCode = '\nParagraph.\n\n```\nbar\n```\n';
      let count = 0;
      const client: GeminiClient = mock.fn((input) => {
        calls.push({ feedback: input.feedback });
        count++;
        if (count === 1) return Promise.resolve({ title_en: 'Title', body_en: brokenWithDifferentCode });
        // 2 回目は source と同じ本文に直す
        return Promise.resolve({ title_en: 'Title', body_en: '\nParagraph.\n\n```\nfoo\n```\n' });
      });
      await translateOne(makeArgs({ jaContent: jaWithCode, geminiClient: client }));
      const feedback = calls[1].feedback;
      assert.ok(feedback);
      // 数値だけでなく具体的な差分内容（detail）が含まれている
      assert.match(feedback, /codeBlockContent/);
      assert.match(feedback, /code block content modified/);
    });
  });

  describe('defense-in-depth: 手動 en の保護', () => {
    test('enContent が YAML パース不能 → API 呼ばず failed を返す', async () => {
      const ja = buildJaContent();
      const corruptedEn = '---\n: not valid yaml :\n  - missing\n---\n\nbody\n';
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: ja, enContent: corruptedEn, geminiClient: client }));
      assert.equal(result.kind, 'failed');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
      assert.ok('reason' in result && result.reason.includes('parse error'));
    });

    test('enContent が手動 en（auto_translated_from なし）→ API 呼ばず failed を返す', async () => {
      const ja = buildJaContent();
      // 手動翻訳された en（auto_translated_from フィールドなし）
      const manualEn = joinFrontmatter(
        {
          title: 'Manual Title',
          slug: 'sample',
          locale: 'en',
          tags: [],
          published: true,
        },
        'Manually translated body.\n',
      );
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: ja, enContent: manualEn, geminiClient: client }));
      assert.equal(result.kind, 'failed');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
      assert.ok('reason' in result && result.reason.includes('manual en detected'));
    });
  });

  describe('エラーハンドリング', () => {
    test('API throw → failed、既存温存', async () => {
      const client: GeminiClient = mock.fn(() => Promise.reject(new Error('network error')));
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'failed');
    });

    test('API throw 時、reason に attempt 番号が含まれる（リトライ中の情報を保持）', async () => {
      let count = 0;
      const client: GeminiClient = mock.fn(() => {
        count++;
        if (count === 1) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.reject(new Error('rate limit'));
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'failed');
      assert.ok('reason' in result);
      // 2 回目（リトライ）で throw したことが reason から分かる
      assert.match(result.reason, /attempt 2\/4/);
      assert.match(result.reason, /rate limit/);
    });
  });
});

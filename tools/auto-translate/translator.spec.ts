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
import type { ProofreaderClient } from './proofreader.ts';
import type { CodeTranslatorClient } from './code-translator.ts';

// テスト用デフォルト proofreader: 常に ok を返す（proofread の動作はそれ自身の spec で検証）
const okProofreader: ProofreaderClient = () => Promise.resolve({ ok: true, issues: [] });
// テスト用デフォルト codeTranslator: 入力をそのまま返す（コメント翻訳しない = no-op）
const noopCodeTranslator: CodeTranslatorClient = (code) => Promise.resolve(code);

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

// 翻訳結果は placeholder protocol に従う:
// LLM は code を見ず ⟨⟨BLOCK_N⟩⟩ ⟨⟨INLINE_N⟩⟩ をそのまま返す。translator が restoreCode で復元する
const TRANSLATED_BODY_OK_TEMPLATE = `Paragraph 1.

⟨⟨BLOCK_0⟩⟩

https://example.com
`;

// restore 後の最終形（テストの期待値として使用）
const TRANSLATED_BODY_OK = `Paragraph 1.

\`\`\`ts
const a = 1;
\`\`\`

https://example.com
`;

// 構造破壊された翻訳: code block placeholder ⟨⟨BLOCK_0⟩⟩ を消失させた
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

// LLM 動作のモック: 受け取った body はプレースホルダ入り。返り値もプレースホルダ入りで返す
// （実 LLM の契約: ⟨⟨BLOCK_N⟩⟩ などをそのまま preserve する）
function makeOkClient(output = { title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE }): GeminiClient {
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
      proofreaderClient: okProofreader,
      codeTranslatorClient: noopCodeTranslator,
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

  describe('リトライパス（placeholder/structure/proofread）', () => {
    test('1 回目 OK → そのまま採用、API 呼び出し 1 回', async () => {
      const client = makeOkClient();
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('placeholder 復元 NG が 2 回連続 → 3 回目 OK → 採用、API 呼び出し 3 回', async () => {
      let count = 0;
      const client: GeminiClient = mock.fn(() => {
        count++;
        if (count <= 2) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE });
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 3);
    });

    test('placeholder 復元 1 回目 NG → 2 回目 OK → 採用、API 呼び出し 2 回', async () => {
      let count = 0;
      const client: GeminiClient = mock.fn(() => {
        count++;
        if (count === 1) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE });
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 2);
    });

    test('placeholder 復元 4 試行全て NG → failed、API 呼び出し 4 回', async () => {
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
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE });
      });
      await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(calls[0].feedback, undefined);
      const feedback = calls[1].feedback;
      assert.ok(feedback);
      assert.match(feedback, /code/i);
    });

    test('構造検証 NG（プレースホルダは保持されたが prose の bare URL paragraph が消失）→ リトライで復旧', async () => {
      // プレースホルダを保持しているので restoreCode は通過する。が、ja の bareUrlParagraphs 数が
      // 合わず validateStructure が ng を返す → buildFeedback でリトライ
      const calls: { feedback?: string }[] = [];
      let count = 0;
      const client: GeminiClient = mock.fn((input) => {
        calls.push({ feedback: input.feedback });
        count++;
        if (count === 1) {
          // bare URL paragraph (https://example.com の単独行) が prose に巻き込まれた
          return Promise.resolve({
            title_en: 'Title',
            body_en: 'Paragraph 1.\n\n⟨⟨BLOCK_0⟩⟩\n\nSee this link: https://example.com here.\n',
          });
        }
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE });
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 2);
      // 2 回目の feedback は buildFeedback 由来（structure mismatch の説明を含む）
      assert.ok(calls[1].feedback);
      assert.match(calls[1].feedback, /bareUrlParagraphs|structural/i);
    });

    test('構造検証が継続失敗 → failed.reason に "structure validation failed" が含まれる', async () => {
      // プレースホルダは保持するが bareUrlParagraphs カウントが常に合わない出力を返す
      const client: GeminiClient = mock.fn(() =>
        Promise.resolve({
          title_en: 'Title',
          body_en: 'Paragraph.\n\n⟨⟨BLOCK_0⟩⟩\n\nSee link https://example.com here.\n',
        }),
      );
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'failed');
      assert.ok('reason' in result && result.reason.includes('structure validation failed'));
    });

    test('placeholder drop（LLM がプレースホルダを消失） → リトライで復旧', async () => {
      // 新アーキテクチャ: LLM には code を見せず ⟨⟨BLOCK_N⟩⟩ のみ渡す。LLM がプレースホルダを drop した場合、
      // restoreCode が throw して translator が retry する
      const calls: { feedback?: string }[] = [];
      let count = 0;
      const client: GeminiClient = mock.fn((input) => {
        calls.push({ feedback: input.feedback });
        count++;
        if (count === 1) {
          // プレースホルダを drop した出力（restoreCode で throw する）
          return Promise.resolve({ title_en: 'Title', body_en: 'Paragraph.\n\nhttps://example.com\n' });
        }
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE });
      });
      const result = await translateOne(makeArgs({ geminiClient: client }));
      assert.equal(result.kind, 'translated');
      assert.equal((client as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 2);
      // 2 回目の feedback にプレースホルダ保全の指示が含まれる
      assert.ok(calls[1].feedback);
      assert.match(calls[1].feedback, /placeholder/i);
    });
  });

  describe('proofread リトライ', () => {
    test('proofread が ng → 2 回目で ok → 採用、translate 呼び出し 2 回 + proofread 呼び出し 2 回', async () => {
      const geminiClient = makeOkClient();
      let proofCount = 0;
      const proofreaderClient: ProofreaderClient = mock.fn(() => {
        proofCount++;
        if (proofCount === 1) {
          return Promise.resolve({
            ok: false,
            issues: [{ location: 'p2', problem: 'wrong variable name', suggestion: 'use waiting not active' }],
          });
        }
        return Promise.resolve({ ok: true, issues: [] });
      });
      const result = await translateOne(makeArgs({ geminiClient, proofreaderClient }));
      assert.equal(result.kind, 'translated');
      assert.equal((geminiClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 2);
      assert.equal((proofreaderClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 2);
    });

    test('proofread が常に ng → 4 試行後 failed', async () => {
      const geminiClient = makeOkClient();
      const proofreaderClient: ProofreaderClient = mock.fn(() =>
        Promise.resolve({
          ok: false,
          issues: [{ location: 'p1', problem: 'persistent', suggestion: 'fix' }],
        }),
      );
      const result = await translateOne(makeArgs({ geminiClient, proofreaderClient }));
      assert.equal(result.kind, 'failed');
      assert.equal((geminiClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 4);
      assert.equal((proofreaderClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 4);
    });

    test('placeholder 復元 NG の attempt では proofread を呼ばない（ローカル検証で先に reject）', async () => {
      let count = 0;
      const geminiClient: GeminiClient = mock.fn(() => {
        count++;
        // TRANSLATED_BODY_BROKEN は ⟨⟨BLOCK_0⟩⟩ を含まないため restoreCode が throw して
        // placeholder 復元失敗となり、proofread には到達しない
        if (count === 1) return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_BROKEN });
        return Promise.resolve({ title_en: 'Title', body_en: TRANSLATED_BODY_OK_TEMPLATE });
      });
      const proofreaderClient: ProofreaderClient = mock.fn(() => Promise.resolve({ ok: true, issues: [] }));
      await translateOne(makeArgs({ geminiClient, proofreaderClient }));
      // 1 回目は placeholder 復元 NG なので proofread 呼ばれない、2 回目で呼ばれる
      assert.equal((proofreaderClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('proofreader が ok=false かつ issues=[] → accept（fail-open: feedback なしでリトライしても無意味）', async () => {
      const geminiClient = makeOkClient();
      const proofreaderClient: ProofreaderClient = mock.fn(() => Promise.resolve({ ok: false, issues: [] }));
      const result = await translateOne(makeArgs({ geminiClient, proofreaderClient }));
      assert.equal(result.kind, 'translated');
      // 1 回で採用される（リトライ消費しない）
      assert.equal((geminiClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('proofreader が ok=true かつ issues 非空 → accept（proofreader 自身の判断を尊重）', async () => {
      const geminiClient = makeOkClient();
      const proofreaderClient: ProofreaderClient = mock.fn(() =>
        Promise.resolve({
          ok: true,
          issues: [{ location: 'p1', problem: 'minor', suggestion: 'no action' }],
        }),
      );
      const result = await translateOne(makeArgs({ geminiClient, proofreaderClient }));
      assert.equal(result.kind, 'translated');
    });

    test('proofreader が throw → fail open で採用される（翻訳全体は止まらない）', async () => {
      const geminiClient = makeOkClient();
      const proofreaderClient: ProofreaderClient = mock.fn(() => Promise.reject(new Error('proofread API down')));
      const result = await translateOne(makeArgs({ geminiClient, proofreaderClient }));
      assert.equal(result.kind, 'translated');
    });
  });

  describe('コメント翻訳統合', () => {
    test('codeTranslator がコメントを翻訳した場合、最終 en にその翻訳が反映される', async () => {
      // ja: 日本語コメント入りコードブロック
      const jaWithJaComment = buildJaContent({
        body: '前文。\n\n```ts\n// 日本語コメント\nconst a = 1;\n```\n\nhttps://example.com\n',
      });
      // codeTranslator は日本語コメントを英訳して返す
      const codeTranslatorClient: CodeTranslatorClient = mock.fn((code) =>
        Promise.resolve(code.replace('// 日本語コメント', '// translated comment')),
      );
      // translator (Gemini) は prose を翻訳して body_en を返す（プレースホルダは保持）
      const geminiClient: GeminiClient = mock.fn(() =>
        Promise.resolve({
          title_en: 'Title',
          body_en: 'Preface.\n\n⟨⟨BLOCK_0⟩⟩\n\nhttps://example.com\n',
        }),
      );
      const result = await translateOne(makeArgs({ jaContent: jaWithJaComment, geminiClient, codeTranslatorClient }));
      assert.equal(result.kind, 'translated');
      assert.ok('enContent' in result);
      // 出力 en に英訳されたコメントが含まれる（インデックスずれや差し替え漏れがないこと）
      assert.match(result.enContent, /\/\/ translated comment/);
      // 元の日本語コメントは含まれない
      assert.ok(!result.enContent.includes('// 日本語コメント'));
      // コードブロックの非コメント部分（const a = 1;）は保持
      assert.match(result.enContent, /const a = 1;/);
      // codeTranslator が呼ばれていること
      assert.equal((codeTranslatorClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 1);
    });

    test('prose 中に ⟨⟨ 文字列が含まれていても escape 経由で正しく復元される（衝突回避）', async () => {
      // 「auto-translate ⟨⟨BLOCK_0⟩⟩ という記法を使う」のように prose に
      // プレースホルダ風文字列がある記事の end-to-end テスト
      const ja = buildJaContent({
        body: 'システムは ⟨⟨BLOCK_0⟩⟩ で識別する。\n\n```ts\nconst x = 1;\n```\n',
      });
      // LLM は escape 後の prose（⟨⟨ → ⟪⟪）を受け取り、それをそのまま英訳して返す（escape は保持）
      const geminiClient: GeminiClient = mock.fn((input) => {
        // input.body には escape された ⟪⟪ が含まれているはず
        assert.match(input.body, /⟪⟪BLOCK_0⟫⟫/);
        return Promise.resolve({
          title_en: 'Title',
          body_en: 'The system identifies via ⟪⟪BLOCK_0⟫⟫.\n\n⟨⟨BLOCK_0⟩⟩\n',
        });
      });
      const result = await translateOne(makeArgs({ jaContent: ja, geminiClient }));
      assert.equal(result.kind, 'translated');
      assert.ok('enContent' in result);
      // 最終 en では escape が復元されて元の ⟨⟨BLOCK_0⟩⟩ 文字列に戻る
      assert.match(result.enContent, /via ⟨⟨BLOCK_0⟩⟩/);
      // コードブロックも正しく復元されている
      assert.match(result.enContent, /const x = 1;/);
      // ⟪⟪ が最終出力に残らない
      assert.ok(!result.enContent.includes('⟪⟪'));
      assert.ok(!result.enContent.includes('⟫⟫'));
    });

    test('codeTranslator が複数ブロックを処理してインデックスずれせず復元される', async () => {
      const jaTwoBlocks = buildJaContent({
        body: '前文。\n\n```ts\n// 一つ目\nconst a = 1;\n```\n\n途中。\n\n```ts\n// 二つ目\nconst b = 2;\n```\n',
      });
      // 各ブロックを「コメント翻訳済み」に変換
      const codeTranslatorClient: CodeTranslatorClient = mock.fn((code) => {
        if (code.includes('一つ目')) return Promise.resolve(code.replace('// 一つ目', '// first block'));
        if (code.includes('二つ目')) return Promise.resolve(code.replace('// 二つ目', '// second block'));
        return Promise.resolve(code);
      });
      const geminiClient: GeminiClient = mock.fn(() =>
        Promise.resolve({
          title_en: 'Title',
          body_en: 'Preface.\n\n⟨⟨BLOCK_0⟩⟩\n\nMiddle.\n\n⟨⟨BLOCK_1⟩⟩\n',
        }),
      );
      const result = await translateOne(makeArgs({ jaContent: jaTwoBlocks, geminiClient, codeTranslatorClient }));
      assert.equal(result.kind, 'translated');
      assert.ok('enContent' in result);
      // BLOCK_0 と BLOCK_1 が正しい順序で復元されている
      const firstIdx = result.enContent.indexOf('// first block');
      const secondIdx = result.enContent.indexOf('// second block');
      assert.ok(firstIdx > 0);
      assert.ok(secondIdx > firstIdx);
    });
  });

  describe('extractCode 例外（escape 文字衝突）の伝播', () => {
    test('ja に予約 escape 文字 ⟪⟪ が含まれる → translateOne は failed を返し API は呼ばれない', async () => {
      const jaWithReserved = buildJaContent({
        body: 'reserved char ⟪⟪ marker\n\n```ts\nconst x = 1;\n```\n',
      });
      const geminiClient = makeOkClient();
      const result = await translateOne(makeArgs({ jaContent: jaWithReserved, geminiClient }));
      assert.equal(result.kind, 'failed');
      // extractCode の専用 failure reason として返される（unexpected error ではない）
      assert.ok('reason' in result && result.reason.startsWith('code extraction failed'));
      assert.ok('reason' in result && result.reason.includes('reserved escape sequence'));
      // extractCode は translateOne 内で実行されるため、API は一切呼ばれない
      assert.equal((geminiClient as unknown as { mock: { calls: unknown[] } }).mock.calls.length, 0);
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

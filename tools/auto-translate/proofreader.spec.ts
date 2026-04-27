import { strict as assert } from 'node:assert';
import { test, describe, mock } from 'node:test';
import { proofread, type ProofreaderClient } from './proofreader.ts';

const MODEL = 'test-model';

describe('proofread', () => {
  test('client が ok=true を返す → ok', async () => {
    const client: ProofreaderClient = mock.fn(() => Promise.resolve({ ok: true, issues: [] }));
    const result = await proofread({ jaSource: 'ja text', enTranslation: 'en text', client, model: MODEL });
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
  });

  test('client が issues を返す → ok=false + issues', async () => {
    const client: ProofreaderClient = mock.fn(() =>
      Promise.resolve({
        ok: false,
        issues: [
          {
            location: 'paragraph 2',
            problem: 'variable name mismatch with code',
            suggestion: 'use waiting instead of active',
          },
        ],
      }),
    );
    const result = await proofread({ jaSource: 'ja text', enTranslation: 'en with bug', client, model: MODEL });
    assert.equal(result.ok, false);
    assert.equal(result.issues.length, 1);
    assert.equal(result.issues[0].problem, 'variable name mismatch with code');
  });

  test('client throw → ok=true（fail open: proofread 失敗で翻訳全体を止めない）', async () => {
    const client: ProofreaderClient = mock.fn(() => Promise.reject(new Error('proofread API error')));
    const result = await proofread({ jaSource: 'ja', enTranslation: 'en', client, model: MODEL });
    // proofread はベストエフォート。失敗時は構造検証 OK のものをそのまま採用
    assert.equal(result.ok, true);
    assert.equal(result.issues.length, 0);
  });
});

describe('formatProofIssues', () => {
  test('空 → 空文字列', async () => {
    const { formatProofIssues } = await import('./proofreader.ts');
    assert.equal(formatProofIssues([]), '');
  });

  test('1 件 → location/problem/suggestion を含む', async () => {
    const { formatProofIssues } = await import('./proofreader.ts');
    const text = formatProofIssues([
      {
        location: 'paragraph 2',
        problem: 'variable name mismatch',
        suggestion: 'use waiting instead of active',
      },
    ]);
    assert.match(text, /paragraph 2/);
    assert.match(text, /variable name mismatch/);
    assert.match(text, /use waiting instead of active/);
  });
});

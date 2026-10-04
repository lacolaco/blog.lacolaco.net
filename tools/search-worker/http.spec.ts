import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { corsHeaders, isBearerAuthorized, isIndexDocs } from './http.ts';

describe('corsHeaders', () => {
  const pattern = '^https://pr-[0-9]+---web-[a-z0-9]+-an\\.a\\.run\\.app$';

  it('パターンに一致するオリジンだけを許可する', () => {
    assert.deepEqual(corsHeaders('https://pr-12---web-abc123-an.a.run.app', pattern), {
      'access-control-allow-origin': 'https://pr-12---web-abc123-an.a.run.app',
      vary: 'origin',
    });
    assert.deepEqual(corsHeaders('https://evil.example.com', pattern), {});
    // 前後に余計な文字が付いたオリジンは通さない
    assert.deepEqual(corsHeaders('https://pr-12---web-abc123-an.a.run.app.evil.com', pattern), {});
  });

  it('パターン未設定 (本番の同一オリジン) では何も許可しない', () => {
    assert.deepEqual(corsHeaders('https://blog.lacolaco.net', undefined), {});
    assert.deepEqual(corsHeaders(null, pattern), {});
  });
});

describe('isBearerAuthorized', () => {
  it('トークンが一致するときだけ通す', async () => {
    assert.equal(await isBearerAuthorized('Bearer secret', 'secret'), true);
    assert.equal(await isBearerAuthorized('Bearer wrong', 'secret'), false);
    assert.equal(await isBearerAuthorized('secret', 'secret'), false);
    assert.equal(await isBearerAuthorized(null, 'secret'), false);
  });

  it('サーバー側のトークンが空なら、空の Bearer でも通さない', async () => {
    assert.equal(await isBearerAuthorized('Bearer ', ''), false);
    assert.equal(await isBearerAuthorized(null, ''), false);
  });
});

describe('isIndexDocs', () => {
  const doc = { slug: 'a', locale: 'ja', title: 't', date: '2026-01-01', channels: ['Angular'], body: 'b' };

  it('記事の配列を受け付ける', () => {
    assert.equal(isIndexDocs([doc]), true);
    assert.equal(isIndexDocs([]), true);
  });

  it('形が違うものは受け付けない', () => {
    assert.equal(isIndexDocs({}), false);
    assert.equal(isIndexDocs([{ ...doc, locale: 'fr' }]), false);
    assert.equal(isIndexDocs([{ ...doc, channels: [1] }]), false);
    assert.equal(isIndexDocs([{ ...doc, body: undefined }]), false);
    assert.equal(isIndexDocs([null]), false);
  });
});

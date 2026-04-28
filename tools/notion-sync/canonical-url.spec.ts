import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { resolveCanonicalUrl } from './canonical-url.ts';

describe('resolveCanonicalUrl', () => {
  test('Notion canonical_url に値がある → distribution によらず採用', () => {
    assert.equal(
      resolveCanonicalUrl('https://example.com/explicit', ['zenn'], 'my-slug'),
      'https://example.com/explicit',
    );
    assert.equal(
      resolveCanonicalUrl('https://example.com/explicit', undefined, 'my-slug'),
      'https://example.com/explicit',
    );
  });

  test('Notion 空 + distribution に "zenn" → Zenn URL を生成', () => {
    assert.equal(resolveCanonicalUrl(undefined, ['zenn'], 'my-slug'), 'https://zenn.dev/lacolaco/articles/my-slug');
    assert.equal(
      resolveCanonicalUrl(undefined, ['blog.lacolaco.net', 'zenn'], 'angular-signal-inputs'),
      'https://zenn.dev/lacolaco/articles/angular-signal-inputs',
    );
  });

  test('Notion 空 + distribution に "zenn" なし → null', () => {
    assert.equal(resolveCanonicalUrl(undefined, ['blog.lacolaco.net'], 'my-slug'), null);
    assert.equal(resolveCanonicalUrl(undefined, ['dev'], 'my-slug'), null);
    assert.equal(resolveCanonicalUrl(undefined, [], 'my-slug'), null);
  });

  test('Notion 空 + distribution undefined → null', () => {
    assert.equal(resolveCanonicalUrl(undefined, undefined, 'my-slug'), null);
  });

  test('Notion 空白文字のみ → 「値なし」として扱う', () => {
    assert.equal(resolveCanonicalUrl('   ', ['zenn'], 'my-slug'), 'https://zenn.dev/lacolaco/articles/my-slug');
    assert.equal(resolveCanonicalUrl('', ['zenn'], 'my-slug'), 'https://zenn.dev/lacolaco/articles/my-slug');
    assert.equal(resolveCanonicalUrl('   ', undefined, 'my-slug'), null);
  });
});

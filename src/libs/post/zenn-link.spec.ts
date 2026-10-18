import { describe, expect, it } from 'vitest';
import { getZennLinkUrl } from './zenn-link';

const ZENN = 'https://zenn.dev/lacolaco/articles/angular-animations-with-motion';

describe('getZennLinkUrl', () => {
  it('日本語の記事で canonical_url が zenn.dev なら、その URL を返す', () => {
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: ZENN })).toBe(ZENN);
  });

  it('locale が未設定の記事は日本語として扱う', () => {
    expect(getZennLinkUrl({ canonical_url: ZENN })).toBe(ZENN);
  });

  it('英語の記事では canonical_url が zenn.dev でも null を返す', () => {
    expect(getZennLinkUrl({ locale: 'en', canonical_url: ZENN })).toBeNull();
  });

  it('canonical_url が未設定なら null を返す', () => {
    expect(getZennLinkUrl({ locale: 'ja' })).toBeNull();
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: '' })).toBeNull();
  });

  it('zenn.dev 以外のホスト (はてなブログなど) なら null を返す', () => {
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'https://lacolaco.hatenablog.com/entry/x' })).toBeNull();
  });

  it('zenn.dev を含む別ホストなら null を返す', () => {
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'https://zenn.dev.example.com/a' })).toBeNull();
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'https://example.com/zenn.dev' })).toBeNull();
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'https://notzenn.dev/a' })).toBeNull();
  });

  it('ホストの大文字小文字を区別しない', () => {
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'https://ZENN.dev/a/articles/b' })).toBe(
      'https://ZENN.dev/a/articles/b',
    );
  });

  it('URL として解釈できない値と http(s) 以外は null を返す', () => {
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'zenn.dev/a' })).toBeNull();
    expect(getZennLinkUrl({ locale: 'ja', canonical_url: 'javascript://zenn.dev/%0Aalert(1)' })).toBeNull();
  });
});

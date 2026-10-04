import { describe, expect, it } from 'vitest';
import { buildSearchUrl, localeOf } from './request';

describe('localeOf', () => {
  it('lang が en なら en、それ以外は ja', () => {
    expect(localeOf('en')).toBe('en');
    expect(localeOf('en-US')).toBe('en');
    expect(localeOf('ja')).toBe('ja');
    expect(localeOf('')).toBe('ja');
    expect(localeOf(undefined)).toBe('ja');
  });
});

describe('buildSearchUrl', () => {
  it('q と locale を付けた URL を返す', () => {
    expect(buildSearchUrl('/api/search', '遅延読み込み', 'ja')).toBe(
      `/api/search?q=${encodeURIComponent('遅延読み込み')}&locale=ja`,
    );
  });
  it('前後の空白を除き、予約文字をエンコードする', () => {
    expect(buildSearchUrl('/api/search', '  a&b=c  ', 'en')).toBe('/api/search?q=a%26b%3Dc&locale=en');
  });
  it('別オリジンの絶対 URL にも付けられる', () => {
    expect(buildSearchUrl('https://x.workers.dev/api/search', 'a', 'en')).toBe(
      'https://x.workers.dev/api/search?q=a&locale=en',
    );
  });
  it('空や空白だけの語では要求しない', () => {
    expect(buildSearchUrl('/api/search', '', 'ja')).toBeNull();
    expect(buildSearchUrl('/api/search', ' 　\t', 'ja')).toBeNull();
  });
});

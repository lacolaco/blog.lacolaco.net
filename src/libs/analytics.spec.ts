import { describe, expect, it, vi } from 'vitest';
import { searchEvents, trackEvent, zennLinkEvents } from './analytics';

describe('searchEvents', () => {
  it('open は search_open と method を返す', () => {
    expect(searchEvents.open('button')).toEqual({ name: 'search_open', params: { method: 'button' } });
    expect(searchEvents.open('keyboard')).toEqual({ name: 'search_open', params: { method: 'keyboard' } });
  });

  it('search は GA4 推奨イベントの search と search_term を返す', () => {
    expect(searchEvents.search('angular signals')).toEqual({
      name: 'search',
      params: { search_term: 'angular signals' },
    });
  });

  it('select は search_select と search_term と slug を返す', () => {
    expect(searchEvents.select('angular', 'my-post')).toEqual({
      name: 'search_select',
      params: { search_term: 'angular', slug: 'my-post' },
    });
  });

  it('検索語は前後の空白を除き、100 文字で切る', () => {
    expect(searchEvents.search('  abc  ').params?.search_term).toBe('abc');
    expect(searchEvents.search('a'.repeat(100)).params?.search_term).toBe('a'.repeat(100));
    expect(searchEvents.search('a'.repeat(101)).params?.search_term).toBe('a'.repeat(100));
    expect(searchEvents.select('a'.repeat(150), 's').params?.search_term).toBe('a'.repeat(100));
  });

  it('サロゲートペアを途中で割らない', () => {
    const term = searchEvents.search('😀'.repeat(101)).params?.search_term as string;
    expect(Array.from(term)).toHaveLength(100);
  });
});

describe('zennLinkEvents', () => {
  it('click は zenn_link_click と slug を返す', () => {
    expect(zennLinkEvents.click('my-post')).toEqual({ name: 'zenn_link_click', params: { slug: 'my-post' } });
  });
});

describe('trackEvent', () => {
  it('window.gtag があればイベント名と引数を渡す', () => {
    const gtag = vi.fn();
    vi.stubGlobal('window', { gtag });
    try {
      trackEvent(searchEvents.search('x'));
      expect(gtag).toHaveBeenCalledExactlyOnceWith('event', 'search', { search_term: 'x' });
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

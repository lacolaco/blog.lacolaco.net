import { describe, expect, it, vi } from 'vitest';
import { initAnalytics, isProductionHost, type GtagWindow } from './analytics-gate';
import { trackEvent } from './analytics';

describe('isProductionHost', () => {
  it.each(['blog.lacolaco.net', 'BLOG.Lacolaco.NET'])('本番のホスト名 %s は計測する', (host) => {
    expect(isProductionHost(host)).toBe(true);
  });

  it.each([
    'pr-123---blog-abcdef-an.a.run.app',
    'blog-lacolaco-net.pages.dev',
    'abc123.blog-lacolaco-net.pages.dev',
    '127.0.0.1',
    'localhost',
    'www.blog.lacolaco.net',
    'lacolaco.net',
    'blog.lacolaco.net.evil.com',
    'evil-blog.lacolaco.net',
    'blog.lacolaco.net.',
    '',
  ])('本番以外のホスト名 %s は計測しない', (host) => {
    expect(isProductionHost(host)).toBe(false);
  });
});

describe('initAnalytics', () => {
  const setup = (hostname: string, props?: object) => {
    const record = (...args: unknown[]) => {
      (win.dataLayer ??= []).push(args);
    };
    const win: GtagWindow = { pushToDataLayer: record };
    const loadScript = vi.fn();
    const started = initAnalytics({ hostname, win, loadScript, gtagProps: props });
    return { win, loadScript, started };
  };

  it('本番では gtag.js を 1 回読み込み、config を 1 回だけ呼ぶ (page_view は config が 1 回送る)', () => {
    const { win, loadScript, started } = setup('blog.lacolaco.net', { content_group: 'post' });
    expect(started).toBe(true);
    expect(loadScript).toHaveBeenCalledExactlyOnceWith('https://www.googletagmanager.com/gtag/js?id=G-0BEKSBSM5X');
    const calls = (win.dataLayer ?? []) as unknown[][];
    expect(calls.map((c) => c[0])).toEqual(['js', 'config']);
    expect(calls[1]).toEqual(['config', 'G-0BEKSBSM5X', { content_group: 'post' }]);
  });

  it('gtagProps が無ければ config には空のオブジェクトを渡す', () => {
    const { win } = setup('blog.lacolaco.net');
    const config = (win.dataLayer ?? [])[1] as unknown[];
    expect(config[2]).toEqual({});
  });

  it.each(['pr-1---blog-x-an.a.run.app', 'blog-lacolaco-net.pages.dev', '127.0.0.1', 'localhost'])(
    '%s では gtag.js を読み込まず、window.gtag も作らない',
    (host) => {
      const { win, loadScript, started } = setup(host);
      expect(started).toBe(false);
      expect(loadScript).not.toHaveBeenCalled();
      expect(win.gtag).toBeUndefined();
      expect(win.dataLayer).toBeUndefined();
    },
  );

  it('本番以外で trackEvent を呼んでも例外が出ず、送信されない', () => {
    const { win } = setup('localhost');
    vi.stubGlobal('window', win);
    try {
      expect(() => trackEvent({ name: 'summarize_start' })).not.toThrow();
      expect(win.dataLayer).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('pushToDataLayer が無ければ計測を始めない', () => {
    const loadScript = vi.fn();
    expect(initAnalytics({ hostname: 'blog.lacolaco.net', win: {}, loadScript })).toBe(false);
    expect(loadScript).not.toHaveBeenCalled();
  });

  it('本番で trackEvent を呼ぶと event が dataLayer に積まれる', () => {
    const { win } = setup('blog.lacolaco.net');
    vi.stubGlobal('window', win);
    try {
      trackEvent({ name: 'summarize_start', params: { a: 1 } });
      const last = (win.dataLayer ?? []).at(-1);
      expect(last).toEqual(['event', 'summarize_start', { a: 1 }]);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

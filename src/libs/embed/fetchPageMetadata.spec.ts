import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPageMetadata } from './fetchPageMetadata';

// fetchをモック
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('fetchPageMetadata', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllTimers();
  });

  it('5xxエラーでリトライして成功する', async () => {
    // 1回目: 503エラー
    // 2回目: 成功
    mockFetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        headers: new Headers(),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({ 'cache-control': 'max-age=3600' }),
        text: () =>
          Promise.resolve(`
          <html>
            <head>
              <title>Test Title</title>
              <meta property="og:description" content="Test Description" />
              <meta property="og:image" content="https://example.com/image.jpg" />
            </head>
          </html>
        `),
      });

    const result = await fetchPageMetadata('https://example.com');

    expect(result).toEqual({
      title: 'Test Title',
      description: 'Test Description',
      imageUrl: 'https://example.com/image.jpg',
      cacheControl: 'max-age=3600',
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('4xxエラーでリトライせずAbortする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      headers: new Headers(),
    });

    const result = await fetchPageMetadata('https://example.com/notfound');

    expect(result).toEqual({
      title: 'https://example.com/notfound',
      description: '',
      imageUrl: null,
      cacheControl: 'max-age=60, must-revalidate',
    });
    // 4xxエラーなので1回のみ（リトライしない）
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('全リトライ失敗でフォールバックする', async () => {
    // 3回とも503エラー
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
    });

    const result = await fetchPageMetadata('https://example.com');

    expect(result).toEqual({
      title: 'https://example.com',
      description: '',
      imageUrl: null,
      cacheControl: 'max-age=60, must-revalidate',
    });
    // 初回 + 3回リトライ = 4回
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('ネットワークエラーでリトライする', async () => {
    // 1回目: ネットワークエラー
    // 2回目: 成功
    mockFetch.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () =>
        Promise.resolve(`
          <html>
            <head>
              <title>Recovered Title</title>
            </head>
          </html>
        `),
    });

    const result = await fetchPageMetadata('https://example.com');

    expect(result.title).toBe('Recovered Title');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('相対URLの画像パスを絶対URLに解決する', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () =>
        Promise.resolve(`
          <html>
            <head>
              <title>Relative Image Test</title>
              <meta property="og:image" content="/images/hero.jpg" />
            </head>
          </html>
        `),
    });

    const result = await fetchPageMetadata('https://example.com/page');

    expect(result.imageUrl).toBe('https://example.com/images/hero.jpg');
  });

  it('空文字列のog:imageをスキップする', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: () =>
        Promise.resolve(`
          <html>
            <head>
              <title>Empty Image Test</title>
              <meta property="og:image" content="" />
            </head>
          </html>
        `),
    });

    const result = await fetchPageMetadata('https://example.com');

    expect(result.imageUrl).toBeNull();
  });

  it('無効なURLでもエラーをスローせずフォールバックする', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      headers: new Headers(),
    });

    const result = await fetchPageMetadata('invalid-url');

    // エラー時はurl自体を返す
    expect(result.title).toBe('invalid-url');
    expect(result.cacheControl).toBe('max-age=60, must-revalidate');
  });

  it('content-type が HTML 以外なら body を読まずに fallback する (PDF などの巨大バイナリ対策)', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'application/pdf' }),
      body: { cancel } as unknown as ReadableStream<Uint8Array>,
    });

    const result = await fetchPageMetadata('https://example.com/file.pdf');

    expect(result).toEqual({
      title: 'https://example.com/file.pdf',
      description: '',
      imageUrl: null,
      // Cache-Control 未設定なので catch fallback と同じデフォルトに揃える
      cacheControl: 'max-age=60, must-revalidate',
    });
    expect(cancel).toHaveBeenCalled();
  });

  it('content-type が HTML 以外 + Cache-Control ヘッダあり → サーバー指定値を尊重する', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({
        'content-type': 'application/pdf',
        'cache-control': 'public, max-age=86400',
      }),
      body: { cancel } as unknown as ReadableStream<Uint8Array>,
    });

    const result = await fetchPageMetadata('https://example.com/file.pdf');

    expect(result.cacheControl).toBe('public, max-age=86400');
  });

  it('streaming で </head> を見つけた時点で body 読み込みを打ち切る (巨大HTML対策)', async () => {
    const head =
      '<html><head><title>Streamed</title><meta property="og:image" content="https://example.com/og.png"></head>';
    const giantBody = '<body>' + 'x'.repeat(10_000_000) + '</body></html>';
    const fullHtml = head + giantBody;

    // 64KB 単位で chunk 化。reader.read() がどこまで呼ばれるかを観測する
    const encoder = new TextEncoder();
    const chunkSize = 64 * 1024;
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullHtml.length; i += chunkSize) {
      chunks.push(encoder.encode(fullHtml.slice(i, i + chunkSize)));
    }
    let readIndex = 0;
    const cancel = vi.fn().mockResolvedValue(undefined);
    const reader = {
      read: vi.fn(() => {
        if (readIndex >= chunks.length) return Promise.resolve({ done: true, value: undefined });
        return Promise.resolve({ done: false, value: chunks[readIndex++] });
      }),
      cancel,
    };
    const body = { getReader: () => reader } as unknown as ReadableStream<Uint8Array>;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html' }),
      body,
    });

    const result = await fetchPageMetadata('https://example.com');

    expect(result.title).toBe('Streamed');
    expect(result.imageUrl).toBe('https://example.com/og.png');
    // body 全体 (10MB) を読み切らず、最初の chunk で </head> 検出して break していること
    expect(reader.read).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalled();
  });

  it('</head> が見つからないまま上限 byte に達したらそこで打ち切る (壊れたHTML対策)', async () => {
    // head 終端が現れない壊れた HTML
    const malformed = '<html><head><title>Broken</title>' + 'x'.repeat(2_000_000);
    const encoder = new TextEncoder();
    const chunkSize = 128 * 1024;
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < malformed.length; i += chunkSize) {
      chunks.push(encoder.encode(malformed.slice(i, i + chunkSize)));
    }
    let readIndex = 0;
    const cancel = vi.fn().mockResolvedValue(undefined);
    const reader = {
      read: vi.fn(() => {
        if (readIndex >= chunks.length) return Promise.resolve({ done: true, value: undefined });
        return Promise.resolve({ done: false, value: chunks[readIndex++] });
      }),
      cancel,
    };
    const body = { getReader: () => reader } as unknown as ReadableStream<Uint8Array>;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'content-type': 'text/html; charset=utf-8' }),
      body,
    });

    const result = await fetchPageMetadata('https://example.com/broken');

    // title だけは抽出できる
    expect(result.title).toBe('Broken');
    // 上限 512KB に達するまでしか読まない (128KB chunk * 4 = 512KB)
    expect(reader.read).toHaveBeenCalledTimes(4);
    expect(cancel).toHaveBeenCalled();
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPageMetadata } from './index';

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
});

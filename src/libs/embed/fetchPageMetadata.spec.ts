import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// undici.requestをモック
vi.mock('undici', () => ({
  request: vi.fn(),
}));

import { fetchPageMetadata } from './fetchPageMetadata';
import { request } from 'undici';

const mockRequest = request as unknown as Mock;

describe('fetchPageMetadata', () => {
  beforeEach(() => {
    mockRequest.mockReset();
    vi.clearAllTimers();
  });

  it('5xxエラーでリトライして成功する', async () => {
    // 1回目: 503エラー
    // 2回目: 成功
    mockRequest
      .mockResolvedValueOnce({
        statusCode: 503,
        headers: {},
        body: { text: () => Promise.resolve('') },
      })
      .mockResolvedValueOnce({
        statusCode: 200,
        headers: { 'cache-control': 'max-age=3600' },
        body: {
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
        },
      });

    const result = await fetchPageMetadata('https://example.com');

    expect(result).toEqual({
      title: 'Test Title',
      description: 'Test Description',
      imageUrl: 'https://example.com/image.jpg',
      cacheControl: 'max-age=3600',
    });
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('4xxエラーでリトライせずAbortする', async () => {
    mockRequest.mockResolvedValueOnce({
      statusCode: 404,
      headers: {},
      body: { text: () => Promise.resolve('') },
    });

    const result = await fetchPageMetadata('https://example.com/notfound');

    expect(result).toEqual({
      title: 'https://example.com/notfound',
      description: '',
      imageUrl: null,
      cacheControl: 'max-age=60, must-revalidate',
    });
    // 4xxエラーなので1回のみ（リトライしない）
    expect(mockRequest).toHaveBeenCalledTimes(1);
  });

  it('全リトライ失敗でフォールバックする', async () => {
    // 3回とも503エラー
    mockRequest.mockResolvedValue({
      statusCode: 503,
      headers: {},
      body: { text: () => Promise.resolve('') },
    });

    const result = await fetchPageMetadata('https://example.com');

    expect(result).toEqual({
      title: 'https://example.com',
      description: '',
      imageUrl: null,
      cacheControl: 'max-age=60, must-revalidate',
    });
    // 初回 + 3回リトライ = 4回
    expect(mockRequest).toHaveBeenCalledTimes(4);
  });

  it('ネットワークエラーでリトライする', async () => {
    // 1回目: ネットワークエラー
    // 2回目: 成功
    mockRequest.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
      statusCode: 200,
      headers: {},
      body: {
        text: () =>
          Promise.resolve(`
          <html>
            <head>
              <title>Recovered Title</title>
            </head>
          </html>
        `),
      },
    });

    const result = await fetchPageMetadata('https://example.com');

    expect(result.title).toBe('Recovered Title');
    expect(mockRequest).toHaveBeenCalledTimes(2);
  });

  it('無効なURLでもエラーをスローせずフォールバックする', async () => {
    mockRequest.mockRejectedValue(new Error('Invalid URL'));

    const result = await fetchPageMetadata('invalid-url');

    // エラー時はurl自体を返す
    expect(result.title).toBe('invalid-url');
    expect(result.cacheControl).toBe('max-age=60, must-revalidate');
  });
});

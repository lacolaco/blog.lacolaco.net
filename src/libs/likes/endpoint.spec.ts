import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { APIContext } from 'astro';

const mockGetLikeStatus = vi.fn();
const mockToggleLike = vi.fn();

vi.mock('./', () => ({
  LikesRepository: vi.fn(function () {
    return { getLikeStatus: mockGetLikeStatus, toggleLike: mockToggleLike };
  }),
  SLUG_PATTERN: /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/,
  SLUG_MAX_LENGTH: 200,
  CLIENT_ID_PATTERN: /^[0-9a-f-]{1,128}$/i,
}));

vi.mock('../firestore', () => ({
  MetadataService: vi.fn(function () {}),
  FirestoreClient: vi.fn(function () {}),
}));

import { GET, POST } from '../../pages/api/likes/[slug]';

/** テスト用のAPIContextを生成する */
function createContext(
  method: string,
  slug: string,
  headers: Record<string, string> = {},
  clientAddress = '127.0.0.1',
): APIContext {
  return {
    params: { slug },
    request: new Request(`http://localhost/api/likes/${slug}`, { method, headers }),
    clientAddress,
  } as unknown as APIContext;
}

describe('API /api/likes/[slug]', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGetLikeStatus.mockReset();
    mockToggleLike.mockReset();
    // レート制限ウィンドウ(1秒)を超えて時間を進め、既存エントリをexpireさせる
    vi.advanceTimersByTime(1100);
    import.meta.env.FIRESTORE_DATABASE = 'test-db';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('GET', () => {
    // テスト27: GET 正常系
    it('正常系: 200 + { count, liked } を返す', async () => {
      mockGetLikeStatus.mockResolvedValueOnce({ count: 3, liked: true });
      const ctx = createContext('GET', 'test-slug', {
        'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      const response = await GET(ctx);
      const body: unknown = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ count: 3, liked: true });
      expect(mockGetLikeStatus).toHaveBeenCalledWith('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');
    });

    // テスト28: GET clientId無し
    it('clientId無しで 200 + { count: N, liked: false } を返す', async () => {
      mockGetLikeStatus.mockResolvedValueOnce({ count: 5, liked: false });
      const ctx = createContext('GET', 'valid-slug');

      const response = await GET(ctx);
      const body: unknown = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ count: 5, liked: false });
      expect(mockGetLikeStatus).toHaveBeenCalledWith('valid-slug', '');
    });

    // テスト29: GET 不正slug
    it('不正slugで 400 を返す', async () => {
      const ctx = createContext('GET', 'INVALID SLUG!');

      const response = await GET(ctx);

      expect(response.status).toBe(400);
    });

    // テスト30: GET slug長すぎ
    it('slug長すぎで 400 を返す', async () => {
      const longSlug = 'a'.repeat(201);
      const ctx = createContext('GET', longSlug);

      const response = await GET(ctx);

      expect(response.status).toBe(400);
    });

    // テスト31: GET 不正clientId
    it('不正clientIdで 400 を返す', async () => {
      const ctx = createContext('GET', 'valid-slug-2', { 'x-client-id': 'invalid!@#$' });

      const response = await GET(ctx);

      expect(response.status).toBe(400);
    });

    // GET 内部エラー
    it('内部エラーで 500 を返す', async () => {
      mockGetLikeStatus.mockRejectedValueOnce(new Error('Firestore error'));
      const ctx = createContext('GET', 'get-error', {
        'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      const response = await GET(ctx);

      expect(response.status).toBe(500);
    });
  });

  describe('POST', () => {
    // POST 不正slug
    it('不正slugで 400 を返す', async () => {
      const ctx = createContext('POST', 'INVALID SLUG!', {
        'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      const response = await POST(ctx);

      expect(response.status).toBe(400);
    });

    // POST slug長すぎ
    it('slug長すぎで 400 を返す', async () => {
      const ctx = createContext('POST', 'a'.repeat(201), {
        'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      const response = await POST(ctx);

      expect(response.status).toBe(400);
    });

    // テスト32: POST 正常系
    it('正常系: 200 + { count, liked } を返す', async () => {
      mockToggleLike.mockResolvedValueOnce({ count: 1, liked: true });
      const ctx = createContext('POST', 'post-normal', {
        'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      const response = await POST(ctx);
      const body: unknown = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual({ count: 1, liked: true });
      expect(mockToggleLike).toHaveBeenCalledWith('post-normal', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');
    });

    // テスト33: POST clientId無し
    it('clientId無しで 400 を返す', async () => {
      const ctx = createContext('POST', 'post-no-client');

      const response = await POST(ctx);

      expect(response.status).toBe(400);
    });

    // POST 不正clientId
    it('不正clientIdで 400 を返す', async () => {
      const ctx = createContext('POST', 'post-invalid-client', { 'x-client-id': 'invalid!@#$' });

      const response = await POST(ctx);

      expect(response.status).toBe(400);
    });

    // テスト34: POST レート制限超過
    it('レート制限超過で 429 を返す', async () => {
      mockToggleLike.mockResolvedValue({ count: 1, liked: true });
      const slug = 'post-rate-limit';
      const headers = { 'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee' };

      // 1回目: 成功
      const response1 = await POST(createContext('POST', slug, headers));
      expect(response1.status).toBe(200);

      // 2回目: レート制限（同一IP+slug、1秒以内）
      const response2 = await POST(createContext('POST', slug, headers));
      expect(response2.status).toBe(429);
      expect(response2.headers.get('Retry-After')).toBe('1');
    });

    // テスト35: POST 内部エラー
    it('内部エラーで 500 を返す', async () => {
      mockToggleLike.mockRejectedValueOnce(new Error('Firestore error'));
      // 他のテストのレート制限に引っかからないよう別slugを使用
      const ctx = createContext('POST', 'post-error', {
        'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee',
      });

      const response = await POST(ctx);

      expect(response.status).toBe(500);
    });
  });
});

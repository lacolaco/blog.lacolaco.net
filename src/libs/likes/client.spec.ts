import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// localStorageモック
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

// fetchモック
const mockFetch = vi.fn();

import { getOrCreateClientId, fetchLikeStatus, sendToggleLike } from './client';

describe('likes client', () => {
  beforeEach(() => {
    localStorageMock.clear();
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    mockFetch.mockReset();
    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('getOrCreateClientId', () => {
    // テスト36: 既存UUID → そのまま返却
    it('既存の有効なUUIDをそのまま返す', () => {
      localStorageMock.getItem.mockReturnValueOnce('aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      const result = getOrCreateClientId();

      expect(result).toBe('aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');
      expect(localStorageMock.setItem).not.toHaveBeenCalled();
    });

    // テスト37: 不正値 → 再生成+保存
    it('不正な値が保存されている場合は再生成して保存する', () => {
      localStorageMock.getItem.mockReturnValueOnce('invalid!@#$');
      const mockUuid = '11111111-2222-4333-9444-555555555555';
      vi.stubGlobal('crypto', { randomUUID: () => mockUuid });

      const result = getOrCreateClientId();

      expect(result).toBe(mockUuid);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    // テスト38: 未存在 → 生成+保存
    it('値が未存在の場合は生成して保存する', () => {
      localStorageMock.getItem.mockReturnValueOnce(null);
      const mockUuid = '11111111-2222-4333-9444-555555555555';
      vi.stubGlobal('crypto', { randomUUID: () => mockUuid });

      const result = getOrCreateClientId();

      expect(result).toBe(mockUuid);
      expect(localStorageMock.setItem).toHaveBeenCalled();
    });

    // テスト39: localStorage不可 → セッション限定UUID
    it('localStorage不可時はセッション限定UUIDを返す', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
      });
      const mockUuid = '11111111-2222-4333-9444-555555555555';
      vi.stubGlobal('crypto', { randomUUID: () => mockUuid });

      const result = getOrCreateClientId();

      expect(result).toBe(mockUuid);
    });
  });

  describe('fetchLikeStatus', () => {
    // テスト40: x-client-idヘッダ付きGET
    it('x-client-idヘッダ付きでGETリクエストを送る', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 3, liked: true }),
      });

      const result = await fetchLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(mockFetch).toHaveBeenCalledWith('/api/likes/test-slug', {
        headers: { 'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee' },
      });
      expect(result).toEqual({ count: 3, liked: true });
    });
  });

  describe('sendToggleLike', () => {
    // テスト41: x-client-idヘッダ付きPOST
    it('x-client-idヘッダ付きでPOSTリクエストを送る', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 1, liked: true }),
      });

      const result = await sendToggleLike('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(mockFetch).toHaveBeenCalledWith('/api/likes/test-slug', {
        method: 'POST',
        headers: { 'x-client-id': 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee' },
      });
      expect(result).toEqual({ count: 1, liked: true });
    });
  });

  describe('エラーハンドリング', () => {
    // テスト42: fetchLikeStatusエラーレスポンス → エラーthrow
    it('fetchLikeStatusのエラーレスポンスでエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
    });

    // sendToggleLikeエラーレスポンス → エラーthrow
    it('sendToggleLikeのエラーレスポンスでエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(sendToggleLike('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
    });

    // ネットワークエラー → エラーthrow (fetchLikeStatus)
    it('fetchLikeStatusのネットワークエラーでエラーをスローする', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(fetchLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow(
        'Network Error',
      );
    });

    // ネットワークエラー → エラーthrow (sendToggleLike)
    it('sendToggleLikeのネットワークエラーでエラーをスローする', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network Error'));

      await expect(sendToggleLike('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow(
        'Network Error',
      );
    });
  });
});

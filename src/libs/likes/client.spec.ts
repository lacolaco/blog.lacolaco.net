import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as analytics from '../analytics';

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
    localStorageMock.getItem.mockReset();
    localStorageMock.setItem.mockReset();
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

    // localStorage不可時は呼び出しごとに異なるIDが返る
    it('localStorage不可時は呼び出しごとに新しいUUIDを生成する', () => {
      vi.stubGlobal('localStorage', {
        getItem: () => {
          throw new Error('SecurityError');
        },
        setItem: () => {
          throw new Error('SecurityError');
        },
      });
      let callCount = 0;
      vi.stubGlobal('crypto', {
        randomUUID: () => `uuid-${++callCount}`,
      });

      const result1 = getOrCreateClientId();
      const result2 = getOrCreateClientId();

      expect(result1).not.toBe(result2);
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

    // 成功時にanalytics trackEventが呼ばれる
    it('成功時にlike_toggleイベントを発火する', async () => {
      const trackSpy = vi.spyOn(analytics, 'trackEvent');
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ count: 1, liked: true }),
      });

      await sendToggleLike('test-slug-analytics', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(trackSpy).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'like_toggle', params: { slug: 'test-slug-analytics', liked: true } }),
      );
      trackSpy.mockRestore();
    });
  });

  describe('バリデーション', () => {
    it('fetchLikeStatusに不正slugでエラーをスローする', async () => {
      await expect(fetchLikeStatus('INVALID SLUG!', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('fetchLikeStatusに不正clientIdでエラーをスローする', async () => {
      await expect(fetchLikeStatus('valid-slug', 'bad!id')).rejects.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sendToggleLikeに不正slugでエラーをスローする', async () => {
      await expect(sendToggleLike('INVALID SLUG!', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sendToggleLikeに不正clientIdでエラーをスローする', async () => {
      await expect(sendToggleLike('valid-slug', 'bad!id')).rejects.toThrow();
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('エラーハンドリング', () => {
    // テスト42: fetchLikeStatusエラーレスポンス → エラーthrow + analytics
    it('fetchLikeStatusのエラーレスポンスでエラーをスローしlike_errorを発火する', async () => {
      const trackSpy = vi.spyOn(analytics, 'trackEvent');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(fetchLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
      expect(trackSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'like_error' }));
      trackSpy.mockRestore();
    });

    // sendToggleLikeエラーレスポンス → エラーthrow + analytics
    it('sendToggleLikeのエラーレスポンスでエラーをスローしlike_errorを発火する', async () => {
      const trackSpy = vi.spyOn(analytics, 'trackEvent');
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(sendToggleLike('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
      expect(trackSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'like_error' }));
      trackSpy.mockRestore();
    });

    // ネットワークエラー → エラーthrow + analytics (fetchLikeStatus)
    it('fetchLikeStatusのネットワークエラーでlike_errorを発火する', async () => {
      const trackSpy = vi.spyOn(analytics, 'trackEvent');
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(fetchLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow(
        'Failed to fetch',
      );
      expect(trackSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'like_error' }));
      trackSpy.mockRestore();
    });

    // ネットワークエラー → エラーthrow + analytics (sendToggleLike)
    it('sendToggleLikeのネットワークエラーでlike_errorを発火する', async () => {
      const trackSpy = vi.spyOn(analytics, 'trackEvent');
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));

      await expect(sendToggleLike('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow(
        'Failed to fetch',
      );
      expect(trackSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'like_error' }));
      trackSpy.mockRestore();
    });
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LikeResult } from './types';

// Firestoreモック
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockUpdate = vi.fn();
const mockRunTransaction = vi.fn();

const mockDocRef = (exists: boolean, data: Record<string, unknown> = {}) => ({
  exists,
  data: () => data,
});

vi.mock('./firestore', () => ({
  getFirestore: () => ({
    collection: () => ({
      doc: () => ({
        get: mockGet,
        set: mockSet,
        delete: mockDelete,
        update: mockUpdate,
        collection: () => ({
          doc: () => ({
            get: mockGet,
            set: mockSet,
            delete: mockDelete,
          }),
        }),
      }),
    }),
    runTransaction: mockRunTransaction,
  }),
}));

// テスト対象は実装後にimport
// ここではテスト仕様のみ定義

describe('likes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getLikeStatus', () => {
    it('ドキュメントが存在しない場合、count: 0, liked: false を返す', async () => {
      const { getLikeStatus } = await import('./index');
      mockGet.mockResolvedValueOnce(mockDocRef(false)); // post_likes/{slug}
      mockGet.mockResolvedValueOnce(mockDocRef(false)); // reactions/{clientId}

      const result = await getLikeStatus('test-slug', 'client-123');
      expect(result).toEqual({ count: 0, liked: false });
    });

    it('ドキュメントが存在しclientIdがスキ済みの場合、count: N, liked: true を返す', async () => {
      const { getLikeStatus } = await import('./index');
      mockGet.mockResolvedValueOnce(mockDocRef(true, { count: 5 })); // post_likes/{slug}
      mockGet.mockResolvedValueOnce(mockDocRef(true, { created_at: new Date() })); // reactions/{clientId}

      const result = await getLikeStatus('test-slug', 'client-123');
      expect(result).toEqual({ count: 5, liked: true });
    });

    it('ドキュメントが存在しclientIdが未スキの場合、count: N, liked: false を返す', async () => {
      const { getLikeStatus } = await import('./index');
      mockGet.mockResolvedValueOnce(mockDocRef(true, { count: 3 })); // post_likes/{slug}
      mockGet.mockResolvedValueOnce(mockDocRef(false)); // reactions/{clientId}

      const result = await getLikeStatus('test-slug', 'client-123');
      expect(result).toEqual({ count: 3, liked: false });
    });

    it('clientIdなしの場合、liked: false を返す', async () => {
      const { getLikeStatus } = await import('./index');
      mockGet.mockResolvedValueOnce(mockDocRef(true, { count: 10 }));

      const result = await getLikeStatus('test-slug');
      expect(result).toEqual({ count: 10, liked: false });
    });
  });

  describe('toggleLike', () => {
    it('未スキ→スキ: count +1, liked: true', async () => {
      const { toggleLike } = await import('./index');
      mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<LikeResult>) => {
        const transaction = {
          get: vi
            .fn()
            .mockResolvedValueOnce(mockDocRef(true, { count: 2 })) // post_likes/{slug}
            .mockResolvedValueOnce(mockDocRef(false)), // reactions/{clientId} → 未スキ
          set: vi.fn(),
          update: vi.fn(),
        };
        return fn(transaction);
      });

      const result = await toggleLike('test-slug', 'client-123');
      expect(result).toEqual({ count: 3, liked: true });
    });

    it('スキ済み→取り消し: count -1, liked: false', async () => {
      const { toggleLike } = await import('./index');
      const oldDate = new Date(Date.now() - 10000); // 10秒前（レート制限外）
      mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<LikeResult>) => {
        const transaction = {
          get: vi
            .fn()
            .mockResolvedValueOnce(mockDocRef(true, { count: 5 })) // post_likes/{slug}
            .mockResolvedValueOnce(mockDocRef(true, { created_at: oldDate })), // reactions/{clientId} → スキ済み
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return fn(transaction);
      });

      const result = await toggleLike('test-slug', 'client-123');
      expect(result).toEqual({ count: 4, liked: false });
    });

    it('初めてのスキでドキュメントが存在しない場合、count: 1, liked: true', async () => {
      const { toggleLike } = await import('./index');
      mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<LikeResult>) => {
        const transaction = {
          get: vi
            .fn()
            .mockResolvedValueOnce(mockDocRef(false)) // post_likes/{slug} → 存在しない
            .mockResolvedValueOnce(mockDocRef(false)), // reactions/{clientId} → 未スキ
          set: vi.fn(),
          update: vi.fn(),
        };
        return fn(transaction);
      });

      const result = await toggleLike('test-slug', 'client-123');
      expect(result).toEqual({ count: 1, liked: true });
    });

    it('レート制限: 2秒以内の再トグルでエラー', async () => {
      const { toggleLike } = await import('./index');
      const recentDate = new Date(Date.now() - 1000); // 1秒前
      mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<LikeResult>) => {
        const transaction = {
          get: vi
            .fn()
            .mockResolvedValueOnce(mockDocRef(true, { count: 3 }))
            .mockResolvedValueOnce(mockDocRef(true, { created_at: recentDate })),
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return fn(transaction);
      });

      await expect(toggleLike('test-slug', 'client-123')).rejects.toThrow('RATE_LIMITED');
    });

    it('countが0以下にならない', async () => {
      const { toggleLike } = await import('./index');
      mockRunTransaction.mockImplementation(async (fn: (t: unknown) => Promise<LikeResult>) => {
        const oldDate = new Date(Date.now() - 10000);
        const transaction = {
          get: vi
            .fn()
            .mockResolvedValueOnce(mockDocRef(true, { count: 0 })) // count: 0
            .mockResolvedValueOnce(mockDocRef(true, { created_at: oldDate })), // スキ済み → 取り消し
          set: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
        };
        return fn(transaction);
      });

      const result = await toggleLike('test-slug', 'client-123');
      expect(result.count).toBe(0);
      expect(result.liked).toBe(false);
    });
  });
});

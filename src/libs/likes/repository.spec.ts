import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LikeResponse } from './types';

// Firestoreモック
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockRunTransaction = vi.fn();
const mockReactionDoc = vi.fn();

vi.mock('./firestore', () => ({
  getFirestore: () =>
    Promise.resolve({
      collection: () => ({
        doc: () => ({
          get: mockGet,
          set: mockSet,
          collection: () => ({
            doc: () => ({
              get: mockReactionDoc,
              set: mockSet,
              delete: mockDelete,
            }),
          }),
        }),
      }),
      runTransaction: mockRunTransaction,
    }),
  getFieldValue: () => Promise.resolve({ serverTimestamp: () => 'mock-timestamp' }),
}));

describe('getLikeStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ドキュメント未存在時は count: 0, liked: false を返す', async () => {
    mockGet.mockResolvedValue({ exists: false });
    mockReactionDoc.mockResolvedValue({ exists: false });

    const { getLikeStatus } = await import('./repository');
    const result = await getLikeStatus('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 0, liked: false });
  });

  it('ドキュメント存在・reaction未存在時は liked: false を返す', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ count: 5 }) });
    mockReactionDoc.mockResolvedValue({ exists: false });

    const { getLikeStatus } = await import('./repository');
    const result = await getLikeStatus('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 5, liked: false });
  });

  it('reaction存在時は liked: true を返す', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ count: 10 }) });
    mockReactionDoc.mockResolvedValue({ exists: true });

    const { getLikeStatus } = await import('./repository');
    const result = await getLikeStatus('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 10, liked: true });
  });

  it('clientId未指定時は liked: false を返す', async () => {
    mockGet.mockResolvedValue({ exists: true, data: () => ({ count: 3 }) });

    const { getLikeStatus } = await import('./repository');
    const result = await getLikeStatus('test-slug', '');

    expect(result).toEqual({ count: 3, liked: false });
  });
});

describe('toggleLike', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('未スキ → reaction作成 + count+1', async () => {
    const mockTxGet = vi.fn();
    const mockTxSet = vi.fn();
    const mockTxDelete = vi.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<LikeResponse>) => {
      const tx = { get: mockTxGet, set: mockTxSet, delete: mockTxDelete };

      // post_likesドキュメント: count=5
      mockTxGet.mockResolvedValueOnce({ exists: true, data: () => ({ count: 5 }) });
      // reactionドキュメント: 未存在
      mockTxGet.mockResolvedValueOnce({ exists: false });

      return fn(tx);
    });

    const { toggleLike } = await import('./repository');
    const result = await toggleLike('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 6, liked: true });
    expect(mockTxSet).toHaveBeenCalledTimes(2); // post_likes + reaction
  });

  it('スキ済み → reaction削除 + count-1', async () => {
    const mockTxGet = vi.fn();
    const mockTxSet = vi.fn();
    const mockTxDelete = vi.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<LikeResponse>) => {
      const tx = { get: mockTxGet, set: mockTxSet, delete: mockTxDelete };

      mockTxGet.mockResolvedValueOnce({ exists: true, data: () => ({ count: 5 }) });
      // reactionドキュメント: 存在
      mockTxGet.mockResolvedValueOnce({ exists: true });

      return fn(tx);
    });

    const { toggleLike } = await import('./repository');
    const result = await toggleLike('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 4, liked: false });
    expect(mockTxDelete).toHaveBeenCalledTimes(1);
    expect(mockTxSet).toHaveBeenCalledTimes(1); // post_likesのcount更新のみ
  });

  it('countが0以下にならない', async () => {
    const mockTxGet = vi.fn();
    const mockTxSet = vi.fn();
    const mockTxDelete = vi.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<LikeResponse>) => {
      const tx = { get: mockTxGet, set: mockTxSet, delete: mockTxDelete };

      // count=0 だがreactionが存在（不整合状態）
      mockTxGet.mockResolvedValueOnce({ exists: true, data: () => ({ count: 0 }) });
      mockTxGet.mockResolvedValueOnce({ exists: true });

      return fn(tx);
    });

    const { toggleLike } = await import('./repository');
    const result = await toggleLike('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 0, liked: false });
  });

  it('post_likesドキュメント未存在で初回スキ', async () => {
    const mockTxGet = vi.fn();
    const mockTxSet = vi.fn();
    const mockTxDelete = vi.fn();

    mockRunTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<LikeResponse>) => {
      const tx = { get: mockTxGet, set: mockTxSet, delete: mockTxDelete };

      // post_likesドキュメント: 未存在
      mockTxGet.mockResolvedValueOnce({ exists: false });
      // reactionドキュメント: 未存在
      mockTxGet.mockResolvedValueOnce({ exists: false });

      return fn(tx);
    });

    const { toggleLike } = await import('./repository');
    const result = await toggleLike('test-slug', 'test-client-id');

    expect(result).toEqual({ count: 1, liked: true });
  });
});

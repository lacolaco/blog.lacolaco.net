import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LikesRepository } from './repository';
import type { FirestoreClient } from '../firestore/client';
import type { FirestoreDocument } from '../firestore/types';

/** reactionsマップを持つFirestoreドキュメントを生成するヘルパー */
function createDocWithReactions(reactions: Record<string, boolean>): FirestoreDocument {
  const fields: Record<string, { booleanValue: boolean }> = {};
  for (const [key, value] of Object.entries(reactions)) {
    fields[key] = { booleanValue: value };
  }
  return {
    fields: {
      reactions: { mapValue: { fields } },
    },
  };
}

function createMockClient(): {
  getDocument: ReturnType<typeof vi.fn>;
  commit: ReturnType<typeof vi.fn>;
  buildDocumentName: ReturnType<typeof vi.fn>;
} {
  return {
    getDocument: vi.fn(),
    commit: vi.fn(),
    buildDocumentName: vi.fn((path: string) =>
      Promise.resolve(`projects/test-project/databases/test-db/documents/${path}`),
    ),
  };
}

describe('LikesRepository', () => {
  let mockClient: ReturnType<typeof createMockClient>;
  let repository: LikesRepository;

  beforeEach(() => {
    mockClient = createMockClient();
    repository = new LikesRepository(mockClient as unknown as FirestoreClient);
  });

  describe('getLikeStatus', () => {
    // テスト13: ドキュメント未存在
    it('ドキュメント未存在で count: 0, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);

      const result = await repository.getLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(result).toEqual({ count: 0, liked: false });
    });

    // テスト14: reactionsが空
    it('reactionsが空で count: 0, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(createDocWithReactions({}));

      const result = await repository.getLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(result).toEqual({ count: 0, liked: false });
    });

    // テスト15: 自分のIDあり (3人中)
    it('自分のIDが存在する場合 count: 3, liked: true を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(
        createDocWithReactions({
          'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee': true,
          '11111111-2222-4333-9444-555555555555': true,
          '66666666-7777-4888-9999-aaaaaaaaaaaa': true,
        }),
      );

      const result = await repository.getLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(result).toEqual({ count: 3, liked: true });
    });

    // テスト16: 自分のIDなし (2人中)
    it('自分のIDが存在しない場合 count: 2, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(
        createDocWithReactions({
          '11111111-2222-4333-9444-555555555555': true,
          '66666666-7777-4888-9999-aaaaaaaaaaaa': true,
        }),
      );

      const result = await repository.getLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(result).toEqual({ count: 2, liked: false });
    });

    // テスト17: clientId空文字
    it('clientId空文字で count: N, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(
        createDocWithReactions({
          '11111111-2222-4333-9444-555555555555': true,
          '66666666-7777-4888-9999-aaaaaaaaaaaa': true,
        }),
      );

      const result = await repository.getLikeStatus('test-slug', '');

      expect(result).toEqual({ count: 2, liked: false });
    });

    // テスト18: reactionsフィールドなし
    it('reactionsフィールドなしで count: 0, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce({
        fields: {},
      });

      const result = await repository.getLikeStatus('test-slug', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

      expect(result).toEqual({ count: 0, liked: false });
    });

    // テスト18b: 不正slugでエラー
    it('不正slugでエラーをスローする', async () => {
      await expect(repository.getLikeStatus('INVALID SLUG!', 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee')).rejects.toThrow();
    });
  });

  describe('toggleLike', () => {
    const clientId = 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee';

    // テスト19: 未いいね → Like (初回、ドキュメント未存在)
    it('未いいね → Like (初回) でcommit発行し count: 1, liked: true を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);
      mockClient.commit.mockResolvedValueOnce(undefined);

      const result = await repository.toggleLike('test-slug', clientId);

      expect(mockClient.commit).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ count: 1, liked: true });
    });

    // テスト20: 未いいね → Like (既存reactions有)
    it('未いいね → Like (既存reactions有) でcommit発行し count: N+1, liked: true を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(
        createDocWithReactions({
          '11111111-2222-4333-9444-555555555555': true,
          '66666666-7777-4888-9999-aaaaaaaaaaaa': true,
        }),
      );
      mockClient.commit.mockResolvedValueOnce(undefined);

      const result = await repository.toggleLike('test-slug', clientId);

      expect(mockClient.commit).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ count: 3, liked: true });
    });

    // テスト21: いいね済み → Unlike
    it('いいね済み → Unlike でcommit発行し count: N-1, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(
        createDocWithReactions({
          [clientId]: true,
          '11111111-2222-4333-9444-555555555555': true,
          '66666666-7777-4888-9999-aaaaaaaaaaaa': true,
        }),
      );
      mockClient.commit.mockResolvedValueOnce(undefined);

      const result = await repository.toggleLike('test-slug', clientId);

      expect(mockClient.commit).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ count: 2, liked: false });
    });

    // テスト19b: toggleLikeがbuildDocumentNameを使用する
    it('buildDocumentNameでドキュメント名を構築する', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);
      mockClient.commit.mockResolvedValueOnce(undefined);

      await repository.toggleLike('test-slug', clientId);

      expect(mockClient.buildDocumentName).toHaveBeenCalledWith('post_likes/test-slug');
    });

    // テスト22: 空clientId
    it('空clientIdでエラーをスローする', async () => {
      await expect(repository.toggleLike('test-slug', '')).rejects.toThrow();
    });

    // テスト23: 不正clientId形式
    it('不正clientId形式でエラーをスローする', async () => {
      await expect(repository.toggleLike('test-slug', 'invalid-uuid')).rejects.toThrow();
    });

    // テスト24: 不正slug
    it('不正slugでエラーをスローする', async () => {
      await expect(repository.toggleLike('INVALID SLUG!', clientId)).rejects.toThrow();
    });

    // テスト25: Firestore GETエラー伝播
    it('Firestore GETエラーが伝播する', async () => {
      mockClient.getDocument.mockRejectedValueOnce(new Error('Firestore GET error'));

      await expect(repository.toggleLike('test-slug', clientId)).rejects.toThrow('Firestore GET error');
    });

    // テスト26: Firestore commitエラー伝播
    it('Firestore commitエラーが伝播する', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);
      mockClient.commit.mockRejectedValueOnce(new Error('Firestore commit error'));

      await expect(repository.toggleLike('test-slug', clientId)).rejects.toThrow('Firestore commit error');
    });
  });
});

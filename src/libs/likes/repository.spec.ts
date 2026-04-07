import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LikesRepository } from './repository';
import { createClientId, createSlug } from './constants';
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

const testSlug = createSlug('test-slug');
const testClientId = createClientId('aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee');

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

      const result = await repository.getLikeStatus(testSlug, testClientId);

      expect(result).toEqual({ count: 0, liked: false });
    });

    // テスト14: reactionsが空
    it('reactionsが空で count: 0, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(createDocWithReactions({}));

      const result = await repository.getLikeStatus(testSlug, testClientId);

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

      const result = await repository.getLikeStatus(testSlug, testClientId);

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

      const result = await repository.getLikeStatus(testSlug, testClientId);

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

      const result = await repository.getLikeStatus(testSlug, null);

      expect(result).toEqual({ count: 2, liked: false });
    });

    // テスト18: reactionsフィールドなし
    it('reactionsフィールドなしで count: 0, liked: false を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce({
        fields: {},
      });

      const result = await repository.getLikeStatus(testSlug, testClientId);

      expect(result).toEqual({ count: 0, liked: false });
    });

    // テスト18b: 不正slug/clientIdのバリデーションはbranded type (Slug/ClientId) で
    // コンパイル時に保証されるため、ランタイムテストは不要
  });

  describe('toggleLike', () => {
    const clientId = testClientId;

    // テスト19: 未いいね → Like (初回、ドキュメント未存在)
    it('未いいね → Like (初回) でcommit発行し count: 1, liked: true を返す', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);
      mockClient.commit.mockResolvedValueOnce(undefined);

      const result = await repository.toggleLike(testSlug, clientId);

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

      const result = await repository.toggleLike(testSlug, clientId);

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

      const result = await repository.toggleLike(testSlug, clientId);

      expect(mockClient.commit).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ count: 2, liked: false });
    });

    // テスト19b: toggleLikeがbuildDocumentNameを使用する
    it('buildDocumentNameでドキュメント名を構築する', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);
      mockClient.commit.mockResolvedValueOnce(undefined);

      await repository.toggleLike(testSlug, clientId);

      expect(mockClient.buildDocumentName).toHaveBeenCalledWith('post_likes/test-slug');
    });

    // テスト22-24: slug/clientIdバリデーションはbranded typeでコンパイル時に保証

    // テスト25: Firestore GETエラー伝播
    it('Firestore GETエラーが伝播する', async () => {
      mockClient.getDocument.mockRejectedValueOnce(new Error('Firestore GET error'));

      await expect(repository.toggleLike(testSlug, clientId)).rejects.toThrow('Firestore GET error');
    });

    // テスト26: Firestore commitエラー伝播
    it('Firestore commitエラーが伝播する', async () => {
      mockClient.getDocument.mockResolvedValueOnce(null);
      mockClient.commit.mockRejectedValueOnce(new Error('Firestore commit error'));

      await expect(repository.toggleLike(testSlug, clientId)).rejects.toThrow('Firestore commit error');
    });
  });
});

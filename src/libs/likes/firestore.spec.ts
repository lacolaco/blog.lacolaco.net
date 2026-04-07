import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MetadataService, FirestoreClient } from './firestore';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const METADATA_BASE = 'http://metadata.google.internal/computeMetadata/v1';
const TOKEN_URL = `${METADATA_BASE}/instance/service-accounts/default/token`;
const PROJECT_ID_URL = `${METADATA_BASE}/project/project-id`;

/** mockFetchの指定呼び出しからheadersを取得するヘルパー */
function getCallHeaders(callIndex: number): Record<string, string> {
  return (mockFetch.mock.calls[callIndex]?.[1] as { headers?: Record<string, string> })?.headers ?? {};
}

describe('MetadataService', () => {
  let metadata: MetadataService;

  beforeEach(() => {
    mockFetch.mockReset();
    metadata = new MetadataService();
  });

  describe('getToken', () => {
    // テスト1: メタデータサーバーからトークン取得
    it('メタデータサーバーからトークンを取得する', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'test-token', expires_in: 3600 }),
      });

      await metadata.getToken();

      expect(mockFetch).toHaveBeenCalledWith(TOKEN_URL, {
        headers: { 'Metadata-Flavor': 'Google' },
      });
    });

    // テスト2: キャッシュ有効期間内は再取得しない
    it('キャッシュ有効期間内は再取得しない', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ access_token: 'cached-token', expires_in: 3600 }),
      });

      const token1 = await metadata.getToken();
      const token2 = await metadata.getToken();

      expect(token1).toBe('cached-token');
      expect(token2).toBe('cached-token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // テスト3: キャッシュ期限切れで再取得
    it('キャッシュ期限切れで再取得する', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'token-1', expires_in: 0 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ access_token: 'token-2', expires_in: 3600 }),
        });

      const token1 = await metadata.getToken();
      const token2 = await metadata.getToken();

      expect(token1).toBe('token-1');
      expect(token2).toBe('token-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    // テスト4: メタデータサーバー障害
    it('メタデータサーバー障害でエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(metadata.getToken()).rejects.toThrow();
    });
  });

  describe('getProjectId', () => {
    // テスト4b: project ID取得
    it('メタデータサーバーからproject IDを取得する', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('test-project') });

      const projectId = await metadata.getProjectId();

      expect(projectId).toBe('test-project');
      expect(mockFetch).toHaveBeenCalledWith(PROJECT_ID_URL, {
        headers: { 'Metadata-Flavor': 'Google' },
      });
    });

    // テスト4c: project IDキャッシュ
    it('project IDをキャッシュする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, text: () => Promise.resolve('test-project') });

      await metadata.getProjectId();
      await metadata.getProjectId();

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // テスト4d: project ID取得失敗
    it('project ID取得失敗でエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(metadata.getProjectId()).rejects.toThrow();
    });
  });
});

describe('FirestoreClient', () => {
  let metadata: MetadataService;
  let invalidateSpy: ReturnType<typeof vi.spyOn>;
  let client: FirestoreClient;
  const projectId = 'test-project';
  const database = 'test-db';
  const basePath = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}/documents`;

  beforeEach(() => {
    mockFetch.mockReset();
    metadata = new MetadataService();
    vi.spyOn(metadata, 'getToken').mockResolvedValue('mock-token');
    vi.spyOn(metadata, 'getProjectId').mockResolvedValue(projectId);
    invalidateSpy = vi.spyOn(metadata, 'invalidate').mockImplementation(() => {});
    client = new FirestoreClient(database, metadata);
  });

  describe('getDocument', () => {
    // テスト5: 正しいURLとAuthorizationでfetch
    it('正しいURLとAuthorizationヘッダでfetchする', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ fields: {} }),
      });

      await client.getDocument('post_likes/test-slug');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]?.[0]).toBe(`${basePath}/post_likes/test-slug`);
      expect(getCallHeaders(0)).toMatchObject({ Authorization: 'Bearer mock-token' });
    });

    // テスト6: 存在するドキュメント
    it('存在するドキュメントをパースして返す', async () => {
      const firestoreResponse = {
        fields: {
          reactions: {
            mapValue: {
              fields: {
                'client-1': { booleanValue: true },
              },
            },
          },
        },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(firestoreResponse),
      });

      const doc = await client.getDocument('post_likes/test-slug');

      expect(doc).toEqual(firestoreResponse);
    });

    // テスト7: 存在しないドキュメント (404)
    it('存在しないドキュメントでnullを返す', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

      const doc = await client.getDocument('post_likes/nonexistent');

      expect(doc).toBeNull();
    });

    // テスト8: サーバーエラー (500)
    it('サーバーエラーでエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(client.getDocument('post_likes/test-slug')).rejects.toThrow();
    });

    // テスト8b: getDocumentの401リトライ
    it('401エラーでトークン再取得しリトライする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ fields: {} }),
      });

      vi.spyOn(metadata, 'getToken').mockResolvedValueOnce('expired-token').mockResolvedValueOnce('new-token');

      const doc = await client.getDocument('post_likes/test-slug');

      expect(invalidateSpy).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getCallHeaders(1)).toMatchObject({ Authorization: 'Bearer new-token' });
      expect(doc).toEqual({ fields: {} });
    });
  });

  describe('commit', () => {
    const commitUrl = `${basePath}:commit`;

    // テスト9: 正しいURLとbodyでPOST
    it('正しいURLとbodyでPOSTする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      const writes = [
        {
          update: {
            name: `projects/${projectId}/databases/${database}/documents/post_likes/test-slug`,
            fields: { reactions: { mapValue: { fields: { 'client-1': { booleanValue: true } } } } },
          },
          updateMask: { fieldPaths: ['reactions.client-1'] },
        },
      ];

      await client.commit(writes);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0]?.[0]).toBe(commitUrl);
      const init = mockFetch.mock.calls[0]?.[1] as { method?: string; body?: string };
      expect(init.method).toBe('POST');
      expect(getCallHeaders(0)).toMatchObject({
        Authorization: 'Bearer mock-token',
        'Content-Type': 'application/json',
      });
      expect(init.body).toBe(JSON.stringify({ writes }));
    });

    // テスト10: 成功
    it('成功時に正常終了する', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });

      await expect(
        client.commit([
          {
            update: {
              name: `projects/${projectId}/databases/${database}/documents/post_likes/test-slug`,
              fields: {},
            },
          },
        ]),
      ).resolves.toBeUndefined();
    });

    // テスト11: 失敗 (500)
    it('サーバーエラーでエラーをスローする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });

      await expect(client.commit([{ update: { name: 'dummy', fields: {} } }])).rejects.toThrow();
    });

    // テスト12: 401でリトライ（新トークン使用を検証）
    it('401エラーでトークン再取得しリトライする', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 401 }).mockResolvedValueOnce({ ok: true, status: 200 });

      vi.spyOn(metadata, 'getToken').mockResolvedValueOnce('expired-token').mockResolvedValueOnce('new-token');

      await client.commit([{ update: { name: 'dummy', fields: {} } }]);

      expect(invalidateSpy).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(getCallHeaders(1)).toMatchObject({ Authorization: 'Bearer new-token' });
    });
  });
});

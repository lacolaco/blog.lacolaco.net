import type { FirestoreDocument, FirestoreWrite } from './types';

const METADATA_BASE = 'http://metadata.google.internal/computeMetadata/v1';
const METADATA_HEADERS = { 'Metadata-Flavor': 'Google' } as const;

/** GCPメタデータサーバーからトークンとproject IDを取得するクラス */
export class MetadataService {
  #cachedToken: string | null = null;
  #expiresAt: number = 0;
  #pendingFetch: Promise<string> | null = null;
  #projectId: string | null = null;
  #pendingProjectId: Promise<string> | null = null;

  /** アクセストークンを取得する。キャッシュ有効期間内はキャッシュを返す */
  async getToken(): Promise<string> {
    if (this.#cachedToken && Date.now() < this.#expiresAt) {
      return this.#cachedToken;
    }
    if (this.#pendingFetch) {
      return this.#pendingFetch;
    }
    this.#pendingFetch = this.#fetchToken().finally(() => {
      this.#pendingFetch = null;
    });
    return this.#pendingFetch;
  }

  /** GCPプロジェクトIDを取得する。一度取得したらキャッシュ */
  async getProjectId(): Promise<string> {
    if (this.#projectId) {
      return this.#projectId;
    }
    if (this.#pendingProjectId) {
      return this.#pendingProjectId;
    }
    this.#pendingProjectId = this.#fetchProjectId().finally(() => {
      this.#pendingProjectId = null;
    });
    return this.#pendingProjectId;
  }

  async #fetchProjectId(): Promise<string> {
    const response = await fetch(`${METADATA_BASE}/project/project-id`, {
      headers: METADATA_HEADERS,
    });
    if (!response.ok) {
      throw new Error(`メタデータサーバーエラー (project-id): ${response.status}`);
    }
    this.#projectId = await response.text();
    return this.#projectId;
  }

  async #fetchToken(): Promise<string> {
    const response = await fetch(`${METADATA_BASE}/instance/service-accounts/default/token`, {
      headers: METADATA_HEADERS,
    });
    if (!response.ok) {
      throw new Error(`メタデータサーバーエラー: ${response.status}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.#cachedToken = data.access_token;
    this.#expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.#cachedToken;
  }

  /** トークンキャッシュを無効化する */
  invalidate(): void {
    this.#cachedToken = null;
    this.#expiresAt = 0;
  }
}

/** #fetchWithRetry用のリクエストオプション */
interface FetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

/** Firestore REST APIクライアント */
export class FirestoreClient {
  #database: string;
  #metadata: MetadataService;

  constructor(database: string, metadata: MetadataService) {
    this.#database = database;
    this.#metadata = metadata;
  }

  /** ベースURLを構築する（project IDはメタデータサーバーから取得） */
  async #getBasePath(): Promise<{ url: string; namePrefix: string }> {
    const projectId = await this.#metadata.getProjectId();
    const namePrefix = `projects/${projectId}/databases/${this.#database}/documents`;
    return { url: `https://firestore.googleapis.com/v1/${namePrefix}`, namePrefix };
  }

  /** 401リトライ付きfetch */
  async #fetchWithRetry(url: string, init: FetchOptions): Promise<Response> {
    const token = await this.#metadata.getToken();
    const headers = { ...init.headers, Authorization: `Bearer ${token}` };
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      this.#metadata.invalidate();
      const newToken = await this.#metadata.getToken();
      return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${newToken}` } });
    }
    return response;
  }

  /** ドキュメントのフルリソース名を構築する */
  async buildDocumentName(path: string): Promise<string> {
    const { namePrefix } = await this.#getBasePath();
    return `${namePrefix}/${path}`;
  }

  /** ドキュメントを取得する */
  async getDocument(path: string): Promise<FirestoreDocument | null> {
    const { url } = await this.#getBasePath();
    const response = await this.#fetchWithRetry(`${url}/${path}`, {});
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Firestore GETエラー: ${response.status}`);
    }
    return (await response.json()) as FirestoreDocument;
  }

  /** バッチ書き込み（commit）を実行する */
  async commit(writes: FirestoreWrite[]): Promise<void> {
    const { url } = await this.#getBasePath();
    const response = await this.#fetchWithRetry(`${url}:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes }),
    });
    if (!response.ok) {
      throw new Error(`Firestore commitエラー: ${response.status}`);
    }
  }
}

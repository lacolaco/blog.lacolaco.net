import type { FirestoreDocument } from './types';

const METADATA_URL = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';

/** メタデータサーバーからアクセストークンを取得するクラス */
export class TokenManager {
  #cachedToken: string | null = null;
  #expiresAt: number = 0;

  /** トークンを取得する。キャッシュ有効期間内はキャッシュを返す */
  async getToken(): Promise<string> {
    if (this.#cachedToken && Date.now() < this.#expiresAt) {
      return this.#cachedToken;
    }
    const response = await fetch(METADATA_URL, {
      headers: { 'Metadata-Flavor': 'Google' },
    });
    if (!response.ok) {
      throw new Error(`メタデータサーバーエラー: ${response.status}`);
    }
    const data = (await response.json()) as { access_token: string; expires_in: number };
    this.#cachedToken = data.access_token;
    // expires_in秒前にマージンを設けてキャッシュ
    this.#expiresAt = Date.now() + (data.expires_in - 60) * 1000;
    return this.#cachedToken;
  }

  /** キャッシュを無効化する */
  invalidate(): void {
    this.#cachedToken = null;
    this.#expiresAt = 0;
  }
}

/** Firestore REST APIクライアント */
export class FirestoreClient {
  #basePath: string;
  #tokenManager: TokenManager;

  constructor(projectId: string, database: string, tokenManager: TokenManager) {
    this.#basePath = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${database}/documents`;
    this.#tokenManager = tokenManager;
  }

  /** 401リトライ付きfetch */
  async #fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
    const token = await this.#tokenManager.getToken();
    const headers = { ...init.headers, Authorization: `Bearer ${token}` };
    const response = await fetch(url, { ...init, headers });
    if (response.status === 401) {
      this.#tokenManager.invalidate();
      const newToken = await this.#tokenManager.getToken();
      return fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${newToken}` } });
    }
    return response;
  }

  /** ドキュメントを取得する */
  async getDocument(path: string): Promise<FirestoreDocument | null> {
    const response = await this.#fetchWithRetry(`${this.#basePath}/${path}`, {});
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Firestore GETエラー: ${response.status}`);
    }
    return (await response.json()) as FirestoreDocument;
  }

  /** バッチ書き込み（commit）を実行する */
  async commit(writes: unknown[]): Promise<void> {
    const response = await this.#fetchWithRetry(`${this.#basePath}:commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ writes }),
    });
    if (!response.ok) {
      throw new Error(`Firestore commitエラー: ${response.status}`);
    }
  }
}

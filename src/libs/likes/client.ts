/**
 * いいね（スキ）クライアント側ロジック
 * localStorage管理 + APIリクエスト
 */

import type { LikeResponse } from './types';
import { UUID_V4_REGEX } from './types';

const STORAGE_KEY = 'likes_client_id';

/** clientIdを取得または生成する（不正な値は再生成、localStorage無効時はセッション限定UUID） */
export function getOrCreateClientId(): string {
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && UUID_V4_REGEX.test(existing)) {
      return existing;
    }
    const id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
    return id;
  } catch {
    // Safari プライベートブラウジング等でlocalStorageが無効な場合
    return crypto.randomUUID();
  }
}

/** スキ状態を取得する */
export async function fetchLikeStatus(slug: string, clientId: string): Promise<LikeResponse> {
  const headers: Record<string, string> = {};
  if (clientId) {
    headers['x-client-id'] = clientId;
  }
  const res = await fetch(`/api/likes/${slug}`, { headers });
  if (!res.ok) {
    throw new Error('Failed to fetch like status');
  }
  return (await res.json()) as LikeResponse;
}

/** スキをトグルする */
export async function sendToggleLike(slug: string, clientId: string): Promise<LikeResponse> {
  const res = await fetch(`/api/likes/${slug}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId }),
  });

  if (!res.ok) {
    throw new Error('Failed to toggle like');
  }

  return (await res.json()) as LikeResponse;
}

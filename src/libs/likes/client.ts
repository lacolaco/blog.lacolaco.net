/**
 * いいね（スキ）クライアント側ロジック
 * localStorage管理 + APIリクエスト
 */

import type { LikeResponse } from './types';

const STORAGE_KEY = 'likes_client_id';
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** clientIdを取得または生成する（不正な値はlocalStorageから削除して再生成） */
export function getOrCreateClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing && UUID_V4_REGEX.test(existing)) {
    return existing;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
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

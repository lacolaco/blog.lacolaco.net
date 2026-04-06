/**
 * いいね（スキ）クライアント側ロジック
 * localStorage管理 + APIリクエスト
 */

import type { LikeResponse } from './types';

const STORAGE_KEY = 'likes_client_id';

/** clientIdを取得または生成する */
export function getOrCreateClientId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}

/** スキ状態を取得する */
export async function fetchLikeStatus(slug: string, clientId: string): Promise<LikeResponse> {
  const url = clientId ? `/api/likes/${slug}?clientId=${encodeURIComponent(clientId)}` : `/api/likes/${slug}`;
  const res = await fetch(url);
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

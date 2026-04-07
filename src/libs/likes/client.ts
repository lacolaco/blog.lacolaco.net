import { likeEvents, trackEvent } from '../analytics';
import { createClientId, tryCreateClientId } from './constants';
import { LikeStatus } from './types';
import type { ClientId, Slug } from './types';

const CLIENT_ID_KEY = 'likes_client_id';

/** clientIdを取得または生成する。localStorage不可時は毎回新規生成（呼び出し側でキャッシュすること） */
export function getOrCreateClientId(): ClientId {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    const existing = stored ? tryCreateClientId(stored) : null;
    if (existing) {
      return existing;
    }
    const newId = createClientId(crypto.randomUUID());
    localStorage.setItem(CLIENT_ID_KEY, newId);
    return newId;
  } catch {
    // localStorage不可（Safari Private等）: 毎回生成。
    // セッション内での一貫性はUI層（React state等）で担保する。
    return createClientId(crypto.randomUUID());
  }
}

/** fetch実行。ネットワークエラー（TypeError）時はanalytics発火してre-throw */
async function fetchWithTracking(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    if (error instanceof TypeError) {
      trackEvent(likeEvents.error(`${init?.method ?? 'GET'} ${url} network error: ${error.message}`));
    }
    throw error;
  }
}

/** いいね状態を取得する */
export async function fetchLikeStatus(slug: Slug, clientId: ClientId): Promise<LikeStatus> {
  const response = await fetchWithTracking(`/api/likes/${slug}`, {
    headers: { 'x-client-id': clientId },
  });
  if (!response.ok) {
    trackEvent(likeEvents.error(`GET /api/likes/${slug} failed: ${response.status}`));
    throw new Error(`Failed to fetch like status: ${response.status}`);
  }
  return LikeStatus.parse(await response.json());
}

/** いいねをトグルする */
export async function sendToggleLike(slug: Slug, clientId: ClientId): Promise<LikeStatus> {
  const response = await fetchWithTracking(`/api/likes/${slug}`, {
    method: 'POST',
    headers: { 'x-client-id': clientId },
  });
  if (!response.ok) {
    trackEvent(likeEvents.error(`POST /api/likes/${slug} failed: ${response.status}`));
    throw new Error(`Failed to toggle like: ${response.status}`);
  }
  const result = LikeStatus.parse(await response.json());
  trackEvent(likeEvents.toggle(slug, result.liked));
  return result;
}

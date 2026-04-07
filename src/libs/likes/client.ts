import { likeEvents, trackEvent } from '../analytics';
import { isValidClientId, validateClientId, validateSlug } from './constants';
import type { LikeStatus } from './types';

const CLIENT_ID_KEY = 'likes_client_id';

/** clientIdを取得または生成する。localStorage不可時は毎回新規生成（呼び出し側でキャッシュすること） */
export function getOrCreateClientId(): string {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && isValidClientId(stored)) {
      return stored;
    }
    const newId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, newId);
    return newId;
  } catch {
    // localStorage不可（Safari Private等）: 毎回生成。
    // セッション内での一貫性はUI層（React state等）で担保する。
    return crypto.randomUUID();
  }
}

/** いいね状態を取得する */
export async function fetchLikeStatus(slug: string, clientId: string): Promise<LikeStatus> {
  validateSlug(slug);
  validateClientId(clientId);
  try {
    const response = await fetch(`/api/likes/${slug}`, {
      headers: { 'x-client-id': clientId },
    });
    if (!response.ok) {
      trackEvent(likeEvents.error(`GET /api/likes/${slug} failed: ${response.status}`));
      throw new Error(`Failed to fetch like status: ${response.status}`);
    }
    return (await response.json()) as LikeStatus;
  } catch (error) {
    if (error instanceof TypeError) {
      trackEvent(likeEvents.error(`GET /api/likes/${slug} network error: ${error.message}`));
    }
    throw error;
  }
}

/** いいねをトグルする */
export async function sendToggleLike(slug: string, clientId: string): Promise<LikeStatus> {
  validateSlug(slug);
  validateClientId(clientId);
  try {
    const response = await fetch(`/api/likes/${slug}`, {
      method: 'POST',
      headers: { 'x-client-id': clientId },
    });
    if (!response.ok) {
      trackEvent(likeEvents.error(`POST /api/likes/${slug} failed: ${response.status}`));
      throw new Error(`Failed to toggle like: ${response.status}`);
    }
    const result = (await response.json()) as LikeStatus;
    trackEvent(likeEvents.toggle(slug, result.liked));
    return result;
  } catch (error) {
    if (error instanceof TypeError) {
      trackEvent(likeEvents.error(`POST /api/likes/${slug} network error: ${error.message}`));
    }
    throw error;
  }
}

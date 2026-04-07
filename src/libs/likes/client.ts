import { likeEvents, trackEvent } from '../analytics';
import { CLIENT_ID_PATTERN } from './constants';
import type { LikeStatus } from './types';

const CLIENT_ID_KEY = 'likes_client_id';

/** セッション限定UUID（localStorage不可時のフォールバック） */
let sessionClientId: string | null = null;

/** clientIdを取得または生成する */
export function getOrCreateClientId(): string {
  try {
    const stored = localStorage.getItem(CLIENT_ID_KEY);
    if (stored && CLIENT_ID_PATTERN.test(stored)) {
      return stored;
    }
    const newId = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, newId);
    return newId;
  } catch {
    // localStorage不可（Safari Private等）: セッション限定UUID
    if (!sessionClientId) {
      sessionClientId = crypto.randomUUID();
    }
    return sessionClientId;
  }
}

/** いいね状態を取得する */
export async function fetchLikeStatus(slug: string, clientId: string): Promise<LikeStatus> {
  const response = await fetch(`/api/likes/${slug}`, {
    headers: { 'x-client-id': clientId },
  });
  if (!response.ok) {
    trackEvent(likeEvents.error(`GET /api/likes/${slug} failed: ${response.status}`));
    throw new Error(`Failed to fetch like status: ${response.status}`);
  }
  return (await response.json()) as LikeStatus;
}

/** いいねをトグルする */
export async function sendToggleLike(slug: string, clientId: string): Promise<LikeStatus> {
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
}

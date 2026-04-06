import type { APIContext } from 'astro';
import { getLikeStatus, toggleLike } from '../../../libs/likes/repository';

export const prerender = false;

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_REGEX = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
const SLUG_MAX_LENGTH = 200;

/**
 * in-memoryレート制限: IP+slug単位、1秒に1回まで
 * 制約: Cloud Runマルチインスタンス環境では各インスタンスが独立したMapを保持するため、
 * インスタンスをまたいだレート制限は機能しない。単一インスタンス内での連打防止が目的。
 */
const RATE_LIMIT_WINDOW_MS = 1000;
const rateLimitMap = new Map<string, number>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(key);
  if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW_MS) {
    return true;
  }
  rateLimitMap.set(key, now);
  // 古いエントリを定期的にクリーンアップ（1000件超で）
  if (rateLimitMap.size > 1000) {
    for (const [k, v] of rateLimitMap) {
      if (now - v > RATE_LIMIT_WINDOW_MS * 10) {
        rateLimitMap.delete(k);
      }
    }
  }
  return false;
}

function getClientIP(context: APIContext): string {
  return (
    context.request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    context.request.headers.get('cf-connecting-ip') ||
    'unknown'
  );
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(context: APIContext): Promise<Response> {
  const slug = context.params.slug;
  if (!slug || slug.length > SLUG_MAX_LENGTH || !SLUG_REGEX.test(slug)) {
    return jsonResponse({ error: 'Invalid slug' }, 400);
  }

  const clientId = context.url.searchParams.get('clientId') ?? '';

  if (clientId && !UUID_V4_REGEX.test(clientId)) {
    return jsonResponse({ error: 'Invalid clientId format' }, 400);
  }

  try {
    const result = await getLikeStatus(slug, clientId);
    return jsonResponse(result);
  } catch (error) {
    console.error('Failed to get like status:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

export async function POST(context: APIContext): Promise<Response> {
  const slug = context.params.slug;
  if (!slug || slug.length > SLUG_MAX_LENGTH || !SLUG_REGEX.test(slug)) {
    return jsonResponse({ error: 'Invalid slug' }, 400);
  }

  let body: { clientId?: string };
  try {
    body = (await context.request.json()) as { clientId?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { clientId } = body;
  if (!clientId || !UUID_V4_REGEX.test(clientId)) {
    return jsonResponse({ error: 'Valid clientId is required' }, 400);
  }

  const ip = getClientIP(context);
  const rateLimitKey = `${ip}:${slug}`;
  if (isRateLimited(rateLimitKey)) {
    return jsonResponse({ error: 'Too many requests' }, 429);
  }

  try {
    const result = await toggleLike(slug, clientId);
    return jsonResponse(result);
  } catch (error) {
    console.error('Failed to toggle like:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

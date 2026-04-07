import type { APIContext } from 'astro';
import { FirestoreClient, MetadataService } from '../../../libs/firestore';
import { isValidClientId, LikesRepository, SLUG_MAX_LENGTH, SLUG_PATTERN } from '../../../libs/likes';

export const prerender = false;

// レート制限: IP+slug単位、1秒1回、LRU Map上限1000
// プロセスメモリ上の状態のため、Cloud Runスケールアウト時はインスタンス間で共有されない。
// 個人ブログの同時アクセス頻度では実質的に問題にならない。
const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_ENTRIES = 1000;
const rateLimitMap = new Map<string, number>();

let repository: LikesRepository | null = null;

function getRepository(): LikesRepository {
  if (!repository) {
    const database = import.meta.env.FIRESTORE_DATABASE as string | undefined;
    if (!database) {
      throw new Error('FIRESTORE_DATABASE is not set');
    }
    repository = new LikesRepository(new FirestoreClient(database, new MetadataService()));
  }
  return repository;
}

function validateSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= SLUG_MAX_LENGTH;
}

/** レート制限チェック。制限中ならtrueを返す */
function isRateLimited(key: string, now: number): boolean {
  const lastTime = rateLimitMap.get(key);
  if (lastTime !== undefined && now - lastTime < RATE_LIMIT_WINDOW_MS) {
    // エントリ位置を変更しない: 攻撃者のエントリをLRU保護すると
    // 正規ユーザーが先にエビクションされるため
    return true;
  }
  // LRU: 既存キーを末尾に移動するため削除→再挿入
  rateLimitMap.delete(key);
  if (rateLimitMap.size >= RATE_LIMIT_MAX_ENTRIES) {
    for (const firstKey of rateLimitMap.keys()) {
      rateLimitMap.delete(firstKey);
      break;
    }
  }
  rateLimitMap.set(key, now);
  return false;
}

function jsonResponse(data: unknown, status = 200, extraHeaders?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}

export async function GET(context: APIContext): Promise<Response> {
  const slug = context.params.slug!;
  if (!validateSlug(slug)) {
    return jsonResponse({ error: 'Invalid slug' }, 400);
  }

  const rawClientId = context.request.headers.get('x-client-id') ?? '';
  if (rawClientId !== '' && !isValidClientId(rawClientId)) {
    return jsonResponse({ error: 'Invalid client ID' }, 400);
  }
  const clientId = rawClientId.toLowerCase();

  try {
    const repo = getRepository();
    const status = await repo.getLikeStatus(slug, clientId);
    return jsonResponse(status);
  } catch (error) {
    console.error('[likes API] unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

export async function POST(context: APIContext): Promise<Response> {
  const slug = context.params.slug!;
  if (!validateSlug(slug)) {
    return jsonResponse({ error: 'Invalid slug' }, 400);
  }

  const rawClientId = context.request.headers.get('x-client-id') ?? '';
  if (!rawClientId) {
    return jsonResponse({ error: 'x-client-id header is required' }, 400);
  }
  if (!isValidClientId(rawClientId)) {
    return jsonResponse({ error: 'Invalid client ID' }, 400);
  }
  const clientId = rawClientId.toLowerCase();

  // レート制限チェック
  // Cloud Runに直接接続されるためclientAddressは実クライアントIP
  // （CloudflareはR2/OG画像キャッシュのみ使用、APIはプロキシ経由ではない）
  const rateLimitKey = `${context.clientAddress}:${slug}`;
  if (isRateLimited(rateLimitKey, Date.now())) {
    return jsonResponse({ error: 'Too many requests' }, 429, {
      'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
    });
  }

  try {
    const repo = getRepository();
    const status = await repo.toggleLike(slug, clientId);
    return jsonResponse(status);
  } catch (error) {
    console.error('[likes API] unexpected error:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
}

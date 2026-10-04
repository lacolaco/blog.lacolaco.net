// Worker の HTTP まわりの判定。Cloudflare に依存しない関数にして、Node のテストで検証する。
import type { IndexDoc } from './search.ts';

/** オリジンが許可パターンに一致するときだけ CORS のヘッダーを返す。パターン未設定 (同一オリジン) は何も許可しない */
export function corsHeaders(origin: string | null, pattern: string | undefined): Record<string, string> {
  if (!origin || !pattern) return {};
  if (!new RegExp(pattern).test(origin)) return {};
  return { 'access-control-allow-origin': origin, vary: 'origin' };
}

/** Authorization ヘッダーが `Bearer <token>` と一致するか。サーバー側のトークンが空なら常に拒否する */
export async function isBearerAuthorized(header: string | null, token: string): Promise<boolean> {
  if (token === '') return false;
  // 長さの違いから token の長さが漏れないよう、SHA-256 で固定長にしてから全バイトを比べる
  const digest = async (s: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [given, expected] = await Promise.all([digest(header ?? ''), digest(`Bearer ${token}`)]);
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given[i] ^ expected[i];
  return diff === 0;
}

export function isIndexDocs(x: unknown): x is IndexDoc[] {
  return (
    Array.isArray(x) &&
    x.every((d: unknown) => {
      if (typeof d !== 'object' || d === null) return false;
      const r = d as Record<string, unknown>;
      return (
        typeof r.slug === 'string' &&
        (r.locale === 'ja' || r.locale === 'en') &&
        typeof r.title === 'string' &&
        typeof r.date === 'string' &&
        Array.isArray(r.channels) &&
        r.channels.every((c) => typeof c === 'string') &&
        typeof r.body === 'string'
      );
    })
  );
}

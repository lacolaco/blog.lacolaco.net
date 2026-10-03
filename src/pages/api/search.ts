import type { APIContext } from 'astro';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { openReadOnly, search } from '../../libs/search/db';

export const prerender = false;

// DB は読み取り専用で1回だけ開き、プロセス内で使い回す。
// 置き場所は dist/server/search.db (ビルド時に生成され、Docker イメージの dist に含まれる)。
// バンドル後のチャンクの位置に依存しないよう、cwd 基準と import.meta.url 基準の両方を試す。
let db: DatabaseSync | null = null;
function getDb(): DatabaseSync {
  if (db) return db;
  const candidates = [
    process.env.SEARCH_DB_PATH,
    join(process.cwd(), 'dist/server/search.db'),
    fileURLToPath(new URL('../search.db', import.meta.url)),
    fileURLToPath(new URL('../../search.db', import.meta.url)),
  ].filter((p): p is string => !!p);
  const found = candidates.find((p) => existsSync(p));
  if (!found) throw new Error(`search.db not found: ${candidates.join(', ')}`);
  db = openReadOnly(found);
  return db;
}

export function GET({ url }: APIContext): Response {
  const q = (url.searchParams.get('q') ?? '').slice(0, 200);
  const locale = url.searchParams.get('locale');
  if (!q.trim() || (locale !== 'ja' && locale !== 'en')) {
    return Response.json({ error: 'q and locale (ja|en) are required' }, { status: 400 });
  }
  const t0 = performance.now();
  const results = search(getDb(), q, locale, 20);
  const elapsedMs = performance.now() - t0;
  // Cloud Logging は stdout の JSON 1行を jsonPayload として解釈する (severity と message は特別扱い)
  console.log(
    JSON.stringify({ severity: 'INFO', message: 'search', searchQuery: q, locale, hits: results.length, elapsedMs }),
  );
  return Response.json(
    { results },
    { headers: { 'Server-Timing': `search;dur=${elapsedMs.toFixed(3)}`, 'Cache-Control': 'no-store' } },
  );
}

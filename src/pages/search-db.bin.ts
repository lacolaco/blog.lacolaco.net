import type { APIRoute } from 'astro';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { queryAvailablePosts } from '../libs/query/posts';
import { createDb } from '../libs/search/db';
import { toPlain } from '../libs/search/plain';

// 検索 DB のビルド時生成。prerender された出力 (dist/client/search-db.bin) を
// astro.config.ts の integration が dist/server/search.db へ移し、公開配信から外す。
// 理由: Astro の content collection (queryAvailablePosts) は Vite 環境の中でしか使えず、
// build 前後のスクリプトでは公開済み記事の集合を再現できない。ビルドの一部として動く prerender
// ルートなら、既存の公開判定をそのまま使える。
export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await queryAvailablePosts();
  const docs = posts.map((p) => ({
    slug: p.data.slug,
    locale: p.collection === 'postsEn' ? ('en' as const) : ('ja' as const),
    title: p.data.title,
    body: toPlain(p.body ?? ''),
  }));
  const dir = mkdtempSync(join(tmpdir(), 'search-db-'));
  try {
    const path = join(dir, 'search.db');
    createDb(docs, path);
    return new Response(readFileSync(path), { headers: { 'Content-Type': 'application/octet-stream' } });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

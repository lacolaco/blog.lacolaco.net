import { Client, isFullPage } from '@notionhq/client';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

// v12までクライアント側（tools/notion-sync/main.ts）で生成していたslugをNotion側に書き戻す。
// v13で EntryMetadata から slug が削除されたため、Notion側を単一の情報源にする必要がある。
// 既存URL（ = v12 manifestのslug値）を絶対に変えない前提で、Notionのslugプロパティが空のページに
// 限り、v12 manifestに記録されていたslug値を書き戻す。
//
// 【実行履歴】
// - 2026-04-23: v12→v13マイグレーション時に1回実行済み（34/34 succeeded）
// - 再実行は冪等（slug値があるページは自動スキップ）だが通常は不要
// - 新規Notionページでslugが空の場合は get('slug') ?? page.id のフォールバックが働く

const { NOTION_AUTH_TOKEN } = process.env;
if (!NOTION_AUTH_TOKEN) {
  console.error('Please set NOTION_AUTH_TOKEN');
  process.exit(1);
}

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const { values } = parseArgs({
  args,
  allowPositionals: false,
  strict: true,
  options: {
    'dry-run': { type: 'boolean', default: false },
  },
});
const dryRun = values['dry-run'];

const DATASOURCE_ID = 'a902ee6d-dc94-4301-b772-fa5fb8decc0c';
const rootDir = new URL('../..', import.meta.url).pathname;

// v12時代のmanifest.jsonを読み取り、pageId → slug のマッピングを取得
type V12ManifestEntry = { lastModified: string; slug?: string; filePath?: string };
const manifestPath = path.resolve(rootDir, 'manifest.json');
const manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, V12ManifestEntry>;
const v12SlugByPageId = new Map<string, string>();
for (const [pageId, entry] of Object.entries(manifestRaw)) {
  if (entry.slug) {
    v12SlugByPageId.set(pageId, entry.slug);
  }
}
console.log(`Loaded ${v12SlugByPageId.size} slug mappings from manifest.json`);

// v13移行後は manifest.json から slug フィールドが削除されるため、このスクリプトは
// 情報源を失う。再実行されても意味のある結果を返せないので早期終了する。
if (v12SlugByPageId.size === 0) {
  console.warn(
    'Warning: manifest.json にslugフィールドが存在しない。v13移行後のmanifestに対してこのスクリプトは実行できない（情報源なし）。',
  );
  console.warn(
    'このスクリプトはv12→v13マイグレーション時の1回限りのデータ復旧用途。以降の空slugページは main.ts の get("slug") ?? page.id フォールバックで処理される。',
  );
  process.exit(0);
}

const notion = new Client({ auth: NOTION_AUTH_TOKEN, notionVersion: '2025-09-03' });

// Notion datasource全体を走査して、slugが空のページを検出
const targets: { pageId: string; title: string; desiredSlug: string }[] = [];
const skippedNoMapping: { pageId: string; title: string }[] = [];
let cursor: string | undefined;
do {
  // @ts-expect-error - notionhq v5のdatasourcesクエリ型未エクスポート
  const response = await notion.dataSources.query({
    data_source_id: DATASOURCE_ID,
    start_cursor: cursor,
    page_size: 100,
  });
  for (const page of response.results) {
    if (!isFullPage(page)) continue;
    const slugProp = page.properties.slug;
    if (slugProp.type !== 'rich_text') continue;
    if (slugProp.rich_text.length > 0) continue; // 既にslugあり: スキップ
    const titleProp = page.properties.title;
    const title = titleProp.type === 'title' ? titleProp.title.map((t) => t.plain_text).join('') : '(untitled)';
    const desiredSlug = v12SlugByPageId.get(page.id);
    if (desiredSlug === undefined) {
      // v12 manifestに無い = 過去に公開されていなかったページ。書き戻し対象外
      skippedNoMapping.push({ pageId: page.id, title });
      continue;
    }
    targets.push({ pageId: page.id, title, desiredSlug });
  }
  cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
} while (cursor);

console.log(`\nFound ${targets.length} pages to backfill (slug empty in Notion, has v12 slug)`);
for (const { pageId, title, desiredSlug } of targets) {
  console.log(`  ${pageId} "${title}" <- slug="${desiredSlug}"`);
}
if (skippedNoMapping.length > 0) {
  console.log(`\nSkipped ${skippedNoMapping.length} pages (slug empty in Notion, no v12 manifest entry):`);
  for (const { pageId, title } of skippedNoMapping) {
    console.log(`  ${pageId} "${title}"`);
  }
}

if (targets.length === 0) {
  console.log('\nNothing to backfill');
  process.exit(0);
}

if (dryRun) {
  console.log('\nDry-run mode: no pages were updated');
  process.exit(0);
}

console.log(`\nWriting slugs for ${targets.length} pages...`);
let succeeded = 0;
let failed = 0;
// Notion APIのレート制限（約3 req/sec）を回避するため、各リクエスト間に約350msのスリープを挟む
const RATE_LIMIT_SLEEP_MS = 350;
for (const { pageId, title, desiredSlug } of targets) {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        slug: {
          rich_text: [{ type: 'text', text: { content: desiredSlug } }],
        },
      },
    });
    succeeded++;
    console.log(`  [${succeeded}/${targets.length}] ✓ ${pageId} "${title}" <- "${desiredSlug}"`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${pageId} "${title}":`, err);
  }
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_SLEEP_MS));
}

console.log(`\nBackfill completed: { succeeded: ${succeeded}, failed: ${failed} }`);
if (failed > 0) process.exit(1);

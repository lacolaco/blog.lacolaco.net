import { Client, isFullPage } from '@notionhq/client';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import { parseArgs } from 'node:util';

// backfill-slug.ts によるslug書き戻しの副作用として、Notionの`page.last_edited_time`（built-in）が
// 書き戻し実行日時に更新されてしまった。main.tsは `updated_at` プロパティが空の場合に
// `page.last_edited_time` にフォールバックするため、frontmatterの `last_edited_time` が
// 実質的な最終更新日から乖離する。
// このスクリプトは、`updated_at` が空のページに限り、v12 manifestの lastModified 値を書き込んで
// 記事の実質的な最終更新日を復元する。
//
// 【実行履歴】
// - 2026-04-23: v12→v13マイグレーション時に1回実行済み（34/34 succeeded）
// - `updated_at`書き込み後のページは自動スキップされるため再実行は安全
// - ただしbackfill-slug.ts直後に他の編集が挟まると対象絞り込み（page.last_edited_timeとv12
//   manifestの比較）が不正確になる。本スクリプトは backfill-slug.ts 実行直後のみ有効

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

type V12ManifestEntry = { lastModified: string; slug?: string; filePath?: string };
const manifestPath = path.resolve(rootDir, 'manifest.json');
const manifestRaw = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, V12ManifestEntry>;
const v12LastModifiedByPageId = new Map<string, string>();
let hasV12SlugField = false;
for (const [pageId, entry] of Object.entries(manifestRaw)) {
  v12LastModifiedByPageId.set(pageId, entry.lastModified);
  if (entry.slug !== undefined) hasV12SlugField = true;
}
console.log(`Loaded ${v12LastModifiedByPageId.size} lastModified entries from manifest.json`);

// v13移行後は manifest.json から slug フィールドが削除されるため、v12時代のmanifestかを
// slugフィールドの有無で判定する。v13 manifestに対してこのスクリプトを実行すると、
// v13移行後に編集された新記事（lastModifiedが最新、updated_atが空）がターゲット検出され、
// 古いlastModified値がupdated_atに書き込まれるデータ破壊リスクがある。
if (!hasV12SlugField) {
  console.warn(
    'Warning: manifest.json に slug フィールドが存在しない（v13移行後のmanifest）。このスクリプトは実行できない。',
  );
  console.warn(
    'このスクリプトはv12→v13マイグレーション時の backfill-slug.ts 直後のみ有効。v13移行後に再実行するとlast_edited_timeが古い値に上書きされるリスクがある。',
  );
  process.exit(0);
}

const notion = new Client({ auth: NOTION_AUTH_TOKEN, notionVersion: '2025-09-03' });

const targets: { pageId: string; title: string; restoreValue: string }[] = [];
const skipped: { pageId: string; title: string; reason: string }[] = [];
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
    const updatedAtProp = page.properties.updated_at;
    if (updatedAtProp.type !== 'date') continue;
    if (updatedAtProp.date !== null) continue; // 既に値あり: スキップ（手動設定を上書きしない）
    const titleProp = page.properties.title;
    const title = titleProp.type === 'title' ? titleProp.title.map((t) => t.plain_text).join('') : '(untitled)';
    const restoreValue = v12LastModifiedByPageId.get(page.id);
    if (restoreValue === undefined) {
      skipped.push({ pageId: page.id, title, reason: 'not in v12 manifest' });
      continue;
    }
    // Notion現在のlast_edited_timeがv12 manifestと一致するなら変更されていない = 対象外
    // backfillで破壊された34ページのみが差分を持つ（分単位で比較）
    const notionLastEdited = new Date(page.last_edited_time).getTime();
    const v12LastModified = new Date(restoreValue).getTime();
    if (Math.abs(notionLastEdited - v12LastModified) < 60 * 1000) {
      skipped.push({ pageId: page.id, title, reason: 'last_edited_time matches v12 manifest' });
      continue;
    }
    targets.push({ pageId: page.id, title, restoreValue });
  }
  cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
} while (cursor);

console.log(`\nFound ${targets.length} pages to restore (updated_at empty, has v12 lastModified)`);
for (const { pageId, title, restoreValue } of targets) {
  console.log(`  ${pageId} "${title}" <- updated_at="${restoreValue}"`);
}
if (skipped.length > 0) {
  console.log(`\nSkipped ${skipped.length} pages:`);
  for (const { pageId, title, reason } of skipped) {
    console.log(`  ${pageId} "${title}" (${reason})`);
  }
}

if (targets.length === 0) {
  console.log('\nNothing to restore');
  process.exit(0);
}

if (dryRun) {
  console.log('\nDry-run mode: no pages were updated');
  process.exit(0);
}

console.log(`\nWriting updated_at for ${targets.length} pages...`);
let succeeded = 0;
let failed = 0;
// Notion APIのレート制限（約3 req/sec）を回避するため、各リクエスト間に約350msのスリープを挟む
const RATE_LIMIT_SLEEP_MS = 350;
for (const { pageId, title, restoreValue } of targets) {
  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        updated_at: {
          date: { start: restoreValue },
        },
      },
    });
    succeeded++;
    console.log(`  [${succeeded}/${targets.length}] ✓ ${pageId} "${title}" <- "${restoreValue}"`);
  } catch (err) {
    failed++;
    console.error(`  ✗ ${pageId} "${title}":`, err);
  }
  await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_SLEEP_MS));
}

console.log(`\nRestore completed: { succeeded: ${succeeded}, failed: ${failed} }`);
if (failed > 0) process.exit(1);

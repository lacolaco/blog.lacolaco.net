/**
 * マイグレーションスクリプト: category + tags → channels マッピング
 *
 * 既存のfrontmatterを読み取り、マッピングルールに従ってchannels値を生成する。
 * dry-runモードでは差分を出力し、--applyモードではNotion APIで一括更新する。
 *
 * Usage:
 *   npx tsx tools/migrate-channels/main.ts                              # dry-run
 *   NOTION_AUTH_TOKEN=xxx npx tsx tools/migrate-channels/main.ts --apply # Notion更新
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

const args = process.argv.slice(2).filter((arg) => arg !== '--');
const { values } = parseArgs({
  args,
  allowPositionals: false,
  strict: true,
  options: {
    apply: {
      type: 'boolean',
      default: false,
    },
  },
});

const CHANNELS = ['Code', 'Angular', 'Books', 'Thought', 'Life'] as const;
type Channel = (typeof CHANNELS)[number];

type PostMeta = {
  file: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  channels: Channel[];
  notionPageId: string | null;
};

// マッピングルール: category + tags → channels
function deriveChannels(category: string, tags: string[]): Channel[] {
  const channels = new Set<Channel>();

  // Angular タグ → Code + Angular
  if (tags.includes('Angular')) {
    channels.add('Code');
    channels.add('Angular');
  }

  // Tech カテゴリ → Code
  if (category === 'Tech') {
    channels.add('Code');
  }

  // 読書タグ → Books
  if (tags.includes('読書')) {
    channels.add('Books');
  }

  // Idea カテゴリ → 常にThought（他のChannelがあっても追加）
  if (category === 'Idea') {
    channels.add('Thought');
  }

  // Diary カテゴリ → Booksのみの場合はLifeを付けない（書評はBooks購読者向け）
  // それ以外のDiary記事にはLifeを付与
  if (category === 'Diary' && !channels.has('Books')) {
    channels.add('Life');
  }

  return Array.from(channels);
}

// frontmatterを簡易パース
function parseFrontmatter(content: string): {
  category: string;
  tags: string[];
  title: string;
  slug: string;
  notionUrl: string;
} {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { category: '', tags: [], title: '', slug: '', notionUrl: '' };
  const fm = fmMatch[1];

  const categoryMatch = fm.match(/^category:\s*'(.+?)'/m);
  const titleMatch = fm.match(/^title:\s*'(.+?)'/m);
  const slugMatch = fm.match(/^slug:\s*'(.+?)'/m);
  const notionUrlMatch = fm.match(/^notion_url:\s*'(.+?)'/m);

  const tags: string[] = [];
  const tagsSection = fm.match(/^tags:\n((?:\s+-\s+'.+?'\n)*)/m);
  if (tagsSection) {
    const tagLines = tagsSection[1].matchAll(/^\s+-\s+'(.+?)'/gm);
    for (const match of tagLines) {
      tags.push(match[1]);
    }
  }

  return {
    category: categoryMatch?.[1] ?? '',
    tags,
    title: titleMatch?.[1] ?? '',
    slug: slugMatch?.[1] ?? '',
    notionUrl: notionUrlMatch?.[1] ?? '',
  };
}

// notion_url からページIDを抽出
function extractNotionPageId(notionUrl: string): string | null {
  // https://www.notion.so/タイトル-<32文字のID>
  const match = notionUrl.match(/([0-9a-f]{32})$/);
  if (match) return match[1];
  // UUID形式
  const uuidMatch = notionUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '');
  return null;
}

// Notion API でページの channels プロパティを更新（リトライ付き）
async function updateNotionPage(pageId: string, channels: string[], token: string): Promise<void> {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const body = JSON.stringify({
    properties: {
      channels: {
        multi_select: channels.map((name) => ({ name })),
      },
    },
  });
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Notion-Version': '2022-06-28',
  };

  const maxRetries = 5;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { method: 'PATCH', headers, body });

    if (res.ok) return;

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfter = Number(res.headers.get('Retry-After') ?? '1');
      const waitMs = Math.max(retryAfter * 1000, 1000 * 2 ** attempt);
      console.error(`\n  Rate limited, waiting ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})...`);
      await sleep(waitMs);
      continue;
    }

    const text = await res.text();
    throw new Error(`Notion API error ${res.status}: ${text}`);
  }
}

// レート制限対応の待機
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// メイン処理
const rootDir = new URL('../..', import.meta.url).pathname;
const postsDir = join(rootDir, 'src/content/post/notion');
const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));

const results: PostMeta[] = [];
const unmapped: PostMeta[] = [];

for (const file of files) {
  const content = readFileSync(join(postsDir, file), 'utf-8');
  const { category, tags, title, slug, notionUrl } = parseFrontmatter(content);

  if (!category) continue;

  const channels = deriveChannels(category, tags);
  const notionPageId = extractNotionPageId(notionUrl);
  const meta: PostMeta = { file, title, slug, category, tags, channels, notionPageId };
  results.push(meta);

  if (channels.length === 0) {
    unmapped.push(meta);
  }
}

// 結果出力
console.log('=== Channel マッピング結果 ===\n');

const channelCounts = new Map<string, number>();
for (const r of results) {
  for (const ch of r.channels) {
    channelCounts.set(ch, (channelCounts.get(ch) ?? 0) + 1);
  }
}
console.log('Channel別記事数:');
for (const ch of CHANNELS) {
  console.log(`  ${ch}: ${channelCounts.get(ch) ?? 0}`);
}
console.log(`  合計（重複込み）: ${Array.from(channelCounts.values()).reduce((a, b) => a + b, 0)}`);
console.log(`  記事数（ユニーク）: ${results.length}\n`);

const multiChannel = results.filter((r) => r.channels.length > 1);
console.log(`=== 複数Channel所属（${multiChannel.length}件） ===`);
for (const r of multiChannel) {
  console.log(`  [${r.channels.join(', ')}] ${r.title} (${r.file})`);
}

if (unmapped.length > 0) {
  console.log(`\n=== マッピング不能（${unmapped.length}件、要手動設定） ===`);
  for (const r of unmapped) {
    console.log(`  ${r.category} | ${r.tags.join(', ')} | ${r.title} (${r.file})`);
  }
}

console.log('\n=== 全記事マッピング ===');
for (const r of results) {
  console.log(`  ${r.category.padEnd(6)} → [${r.channels.join(', ').padEnd(20)}] ${r.title}`);
}

// --apply: Notion API で一括更新
if (values.apply) {
  const token = process.env.NOTION_AUTH_TOKEN;
  if (!token) {
    console.error('\nError: NOTION_AUTH_TOKEN が設定されていません');
    process.exit(1);
  }

  const missingIds = results.filter((r) => !r.notionPageId);
  if (missingIds.length > 0) {
    console.warn(`\n警告: ${missingIds.length}件のNotion page IDが取得できません:`);
    for (const r of missingIds) {
      console.warn(`  ${r.file} - ${r.title}`);
    }
  }

  const targets = results.filter((r) => r.notionPageId);
  console.log(`\n=== Notion API 更新開始（${targets.length}件） ===`);

  let success = 0;
  let errors = 0;
  for (const r of targets) {
    try {
      await updateNotionPage(r.notionPageId!, r.channels, token);
      success++;
      process.stdout.write(`\r  更新中... ${success + errors}/${targets.length} (成功: ${success}, 失敗: ${errors})`);
      await sleep(500);
    } catch (e) {
      errors++;
      console.error(`\n  Error: ${r.file} (${r.notionPageId}): ${String(e)}`);
    }
  }

  console.log(`\n\n=== 完了: 成功 ${success}件, 失敗 ${errors}件 ===`);
  if (errors > 0) {
    process.exit(1);
  }
}

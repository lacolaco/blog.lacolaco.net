/**
 * Channelに昇格したタグをNotionから除去する
 *
 * 対象:
 *   Angular タグ → Angular Channelの記事から除去
 *   読書 タグ → Books Channelの記事から除去
 *   日記 タグ → Life Channelの記事から除去
 *
 * Usage:
 *   pnpm cleanup-tags              # dry-run
 *   pnpm cleanup-tags -- --apply   # Notion API更新
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
    apply: { type: 'boolean', default: false },
  },
});

// Channelに昇格したタグ: タグ名 → Channel名
const PROMOTED_TAGS: Record<string, string> = {
  Angular: 'Angular',
  読書: 'Books',
  日記: 'Life',
};

type Article = {
  file: string;
  title: string;
  tags: string[];
  channels: string[];
  notionPageId: string | null;
  tagsToRemove: string[];
};

function parseFrontmatter(content: string): {
  title: string;
  tags: string[];
  channels: string[];
  notionUrl: string;
} {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { title: '', tags: [], channels: [], notionUrl: '' };
  const fm = fmMatch[1];

  const title = fm.match(/^title:\s*'(.+?)'/m)?.[1] ?? '';
  const notionUrl = fm.match(/^notion_url:\s*'(.+?)'/m)?.[1] ?? '';

  const tags: string[] = [];
  const tagsSection = fm.match(/^tags:\n((?:\s+-\s+'.+?'\n)*)/m);
  if (tagsSection) {
    for (const m of tagsSection[1].matchAll(/^\s+-\s+'(.+?)'/gm)) tags.push(m[1]);
  }

  const channels: string[] = [];
  const channelsSection = fm.match(/^channels:\n((?:\s+-\s+'.+?'\n)*)/m);
  if (channelsSection) {
    for (const m of channelsSection[1].matchAll(/^\s+-\s+'(.+?)'/gm)) channels.push(m[1]);
  }

  return { title, tags, channels, notionUrl };
}

function extractNotionPageId(notionUrl: string): string | null {
  const match = notionUrl.match(/([0-9a-f]{32})$/);
  if (match) return match[1];
  const uuidMatch = notionUrl.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
  if (uuidMatch) return uuidMatch[1].replace(/-/g, '');
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateNotionPageTags(pageId: string, remainingTags: string[], token: string): Promise<void> {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const body = JSON.stringify({
    properties: {
      tags: {
        multi_select: remainingTags.map((name) => ({ name })),
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

// メイン処理
const rootDir = new URL('../..', import.meta.url).pathname;
const postsDir = join(rootDir, 'src/content/post/notion');
const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));

const targets: Article[] = [];

for (const file of files) {
  const content = readFileSync(join(postsDir, file), 'utf-8');
  const { title, tags, channels, notionUrl } = parseFrontmatter(content);

  const tagsToRemove: string[] = [];
  for (const [tagName, channelName] of Object.entries(PROMOTED_TAGS)) {
    if (channels.includes(channelName) && tags.includes(tagName)) {
      tagsToRemove.push(tagName);
    }
  }

  if (tagsToRemove.length > 0) {
    targets.push({
      file,
      title,
      tags,
      channels,
      notionPageId: extractNotionPageId(notionUrl),
      tagsToRemove,
    });
  }
}

console.log(`=== 昇格タグ除去 ===\n`);
console.log(`対象記事: ${targets.length}件\n`);

for (const t of targets) {
  const remaining = t.tags.filter((tag) => !t.tagsToRemove.includes(tag));
  console.log(`  ${t.file}`);
  console.log(`    除去: ${t.tagsToRemove.join(', ')}`);
  console.log(`    残存: ${remaining.length > 0 ? remaining.join(', ') : '(なし)'}`);
}

if (values.apply) {
  const token = process.env.NOTION_AUTH_TOKEN;
  if (!token) {
    console.error('\nError: NOTION_AUTH_TOKEN が設定されていません');
    process.exit(1);
  }

  const withIds = targets.filter((t) => t.notionPageId);
  console.log(`\n=== Notion API 更新開始（${withIds.length}件） ===`);

  let success = 0;
  let errors = 0;
  for (const t of withIds) {
    const remaining = t.tags.filter((tag) => !t.tagsToRemove.includes(tag));
    try {
      await updateNotionPageTags(t.notionPageId!, remaining, token);
      success++;
      process.stdout.write(`\r  更新中... ${success + errors}/${withIds.length} (成功: ${success}, 失敗: ${errors})`);
      await sleep(500);
    } catch (e) {
      errors++;
      console.error(`\n  Error: ${t.file} (${t.notionPageId}): ${String(e)}`);
    }
  }

  console.log(`\n\n=== 完了: 成功 ${success}件, 失敗 ${errors}件 ===`);
  if (errors > 0) {
    process.exit(1);
  }
}

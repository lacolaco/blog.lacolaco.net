/**
 * マイグレーションスクリプト: category + tags → channels マッピング
 *
 * 既存のfrontmatterを読み取り、マッピングルールに従ってchannels値を生成する。
 * dry-runモードでは差分を出力し、実行モードではNotion APIで一括更新する。
 *
 * Usage:
 *   npx tsx tools/migrate-channels/main.ts              # dry-run（デフォルト）
 *   npx tsx tools/migrate-channels/main.ts --apply       # Notion API更新
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
function parseFrontmatter(content: string): { category: string; tags: string[]; title: string; slug: string } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { category: '', tags: [], title: '', slug: '' };
  const fm = fmMatch[1];

  const categoryMatch = fm.match(/^category:\s*'(.+?)'/m);
  const titleMatch = fm.match(/^title:\s*'(.+?)'/m);
  const slugMatch = fm.match(/^slug:\s*'(.+?)'/m);

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
  };
}

// メイン処理
const rootDir = new URL('../..', import.meta.url).pathname;
const postsDir = join(rootDir, 'src/content/post/notion');
const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));

const results: PostMeta[] = [];
const unmapped: PostMeta[] = [];

for (const file of files) {
  const content = readFileSync(join(postsDir, file), 'utf-8');
  const { category, tags, title, slug } = parseFrontmatter(content);

  if (!category) continue;

  const channels = deriveChannels(category, tags);
  const meta: PostMeta = { file, title, slug, category, tags, channels };
  results.push(meta);

  // ルールで意図通りか怪しいケースを検出
  if (channels.length === 0) {
    unmapped.push(meta);
  }
}

// 結果出力
console.log('=== Channel マッピング結果 ===\n');

// Channel別の記事数
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

// 複数Channelに属する記事
const multiChannel = results.filter((r) => r.channels.length > 1);
console.log(`=== 複数Channel所属（${multiChannel.length}件） ===`);
for (const r of multiChannel) {
  console.log(`  [${r.channels.join(', ')}] ${r.title} (${r.file})`);
}

// マッピングできなかった記事
if (unmapped.length > 0) {
  console.log(`\n=== マッピング不能（${unmapped.length}件、要手動設定） ===`);
  for (const r of unmapped) {
    console.log(`  ${r.category} | ${r.tags.join(', ')} | ${r.title} (${r.file})`);
  }
}

// 全記事の詳細
console.log('\n=== 全記事マッピング ===');
for (const r of results) {
  console.log(`  ${r.category.padEnd(6)} → [${r.channels.join(', ').padEnd(20)}] ${r.title}`);
}

if (values.apply) {
  console.log('\n--apply は未実装です。Notion API連携は別途実装してください。');
}

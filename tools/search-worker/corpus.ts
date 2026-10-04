// 品質テスト用に、content/ の markdown からコーパスを作る (Node 専用)。
// 本番の索引は Astro のコンテンツコレクション (queryAvailablePosts) から作るが、テストはビルドに依存させないため、
// 同じ記事の集合を markdown ファイルから直接読む。本番との差は次の2点。
// - 未公開の記事も含む (本番は公開済みの記事だけ)
// - 日付は frontmatter の先頭10文字をそのまま使う (本番は Asia/Tokyo の yyyy-MM-dd に変換する)。品質テストは日付を検証しない
// channels は本番と同じ getChannels (src/libs/compat.ts) で並べる。
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';
import { getChannels } from '../../src/libs/compat.ts';
import { toPlain } from './plain.ts';
import type { IndexDoc, Locale } from './search.ts';

const root = path.resolve(import.meta.dirname, '../..');

export function loadCorpus(): IndexDoc[] {
  const docs: IndexDoc[] = [];
  for (const dir of ['content/notion/posts', 'content/posts']) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    for (const file of fs.readdirSync(abs).filter((f) => f.endsWith('.md'))) {
      // locale はファイル名で決まる (.en.md なら en)。frontmatter の locale は信用しない
      const locale: Locale = file.endsWith('.en.md') ? 'en' : 'ja';
      const slug = file.replace(/\.en\.md$|\.md$/, '');
      const raw = fs.readFileSync(path.join(abs, file), 'utf-8');
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
      if (!m) throw new Error(`${file} に frontmatter がない`);
      const fm = parseYaml(m[1]) as { title?: string; channels?: string[]; created_time?: string | Date };
      docs.push({
        slug,
        locale,
        title: String(fm.title ?? slug),
        date: String(fm.created_time ?? '').slice(0, 10),
        // getChannels は CollectionEntry を受けるが、使うのは data.channels だけ
        channels: getChannels({ data: { channels: fm.channels } } as Parameters<typeof getChannels>[0]),
        body: toPlain(m[2]),
      });
    }
  }
  return docs;
}

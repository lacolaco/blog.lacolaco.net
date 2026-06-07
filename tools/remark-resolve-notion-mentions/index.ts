import { isPast } from 'date-fns';
import type { Link, Root } from 'mdast';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { parse as parseYaml } from 'yaml';

interface Options {
  // 既定では content/notion/posts (sync 出力) と content/posts (直接執筆) の両方を走査する。
  // src/content.config.ts が両ツリーを 1 collection に束ねており、URL 名前空間は共通。
  postDirs?: string[];
}

interface Frontmatter {
  slug?: string;
  notion_url?: string;
  published?: boolean;
  created_time?: string;
}

const NOTION_URL_PREFIX = 'https://www.notion.so/';
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---/;
// Notion の page id は 32 char hex (dense, page.url 形式) または 8-4-4-4-12 dashed UUID
// (Share menu の copy link 形式) で URL に現れる。両方を受け入れて 32-hex lowercase に
// 正規化したものを map のキーとする。
const NOTION_PAGE_ID_RE = /([0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

function normalizeNotionPageId(url: string): string | null {
  const m = NOTION_PAGE_ID_RE.exec(url);
  if (!m) return null;
  return m[1].replace(/-/g, '').toLowerCase();
}

function* walkMarkdown(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkMarkdown(fullPath);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.md')) yield fullPath;
  }
}

function buildNotionUrlMap(postDirs: readonly string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const dir of postDirs) {
    for (const filePath of walkMarkdown(dir)) {
      const content = readFileSync(filePath, 'utf8');
      const match = FRONTMATTER_RE.exec(content);
      if (!match) continue;
      const fm = parseYaml(match[1]) as Frontmatter;
      if (typeof fm.notion_url !== 'string' || typeof fm.slug !== 'string') continue;
      // queryAvailablePosts と同じ predicate (src/libs/query/posts.ts):
      // 公開済み (published === true) かつ created_time が過去のもののみ URL が生成される。
      // draft / 未来日記への mention は内部 URL を持たないので map に入れない → throw 経路
      // に流して publication invariant を作動させる。
      if (fm.published !== true) continue;
      if (typeof fm.created_time !== 'string' || !isPast(new Date(fm.created_time))) continue;
      const id = normalizeNotionPageId(fm.notion_url);
      if (!id) continue;
      // locale の唯一の出所は collection / filename (src/content.config.ts の不変)。
      // frontmatter.locale は schema 上 optional でかつ collection 由来値で上書きされるため
      // 信用しない。.en.md なら en、それ以外は ja。
      const isEn = basename(filePath).endsWith('.en.md');
      map.set(id, `/posts/${fm.slug}${isEn ? '.en' : ''}`);
    }
  }
  return map;
}

// blog.lacolaco.net の Notion 記事フロントマターには `notion_url`（Notion `page.url`）が
// 出力される。Notion 内の page mention は `[plain_text](https://www.notion.so/...)` 形式の
// markdown link として渡ってくるので、ビルド時に frontmatter から照合表を作って blog 内
// 相対 URL に書き換える。照合表に無い notion.so page URL は build を fail させる
// （publication invariant: 未公開・他配信・draft page への mention は本サイト上に出さない）。
const remarkResolveNotionMentions: Plugin<[Options?], Root> = (options = {}) => {
  const postDirs = options.postDirs ?? [
    join(process.cwd(), 'content', 'notion', 'posts'),
    join(process.cwd(), 'content', 'posts'),
  ];
  let cachedMap: Map<string, string> | null = null;

  return (tree: Root) => {
    cachedMap ??= buildNotionUrlMap(postDirs);
    visit(tree, 'link', (node: Link) => {
      if (!node.url.startsWith(NOTION_URL_PREFIX)) return;
      const id = normalizeNotionPageId(node.url);
      // page id (32-hex or dashed UUID) を持たない notion.so URL はマーケティング・ヘルプ
      // 等の外部 link とみなして触らない。書き換え対象は page mention 由来の link のみ
      if (!id) return;
      const resolved = cachedMap.get(id);
      if (!resolved) {
        throw new Error(
          `[remark-resolve-notion-mentions] Unresolved Notion page URL: ${node.url}\n` +
            `This URL was not found among published blog posts in [${postDirs.join(', ')}]. ` +
            `Ensure the referenced page is published (published: true), dated in the past, and distributed to blog.lacolaco.net.`,
        );
      }
      // fragment (#section) は blog 記事内 heading の anchor に対応する可能性があるので preserve。
      // query (?v=...) は Notion 固有の view 識別子 (gallery view 等) なので捨てる。
      const hashIdx = node.url.indexOf('#');
      node.url = hashIdx >= 0 ? resolved + node.url.slice(hashIdx) : resolved;
    });
  };
};

export default remarkResolveNotionMentions;

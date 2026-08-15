import { readdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildOgImageFileName, computeOgImageHashFromFile } from '../../src/libs/og-image/hash.ts';

/** Notion sync の出力は flat、直接執筆はサブディレクトリを許す (src/content.config.ts と対称) */
const CONTENT_DIR_NAME = 'content';
const NOTION_DIR_NAME = 'notion';
const NOTION_POSTS_DIR = 'notion/posts';
const AUTHORED_POSTS_DIR = 'posts';

/** OG画像の出力先ディレクトリ名。記事slugがこれと衝突すると画像の置き場が重なる */
export const OG_OUTPUT_DIR_NAME = 'og';

export type Locale = 'ja' | 'en';

export interface OgImageTarget {
  filePath: string;
  slug: string;
  locale: Locale;
  title: string;
  publishedDate: Date;
  /** R2上のオブジェクト名 */
  fileName: string;
}

/**
 * locale はファイル名から決める。
 * collection 側も `.en.md` かどうかで locale を上書きしている (src/content.config.ts) ため、
 * frontmatter の locale を出所にすると両者がずれる。
 */
export function localeOf(filePath: string): Locale {
  return filePath.endsWith('.en.md') ? 'en' : 'ja';
}

/** 直接執筆の記事は手で書かれるため CRLF もありうる */
export function readFrontmatter(filePath: string): Record<string, unknown> {
  const raw = readFileSync(filePath, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
  if (!match) {
    throw new Error(`${filePath} に frontmatter がない`);
  }
  return parseYaml(match[1]) as Record<string, unknown>;
}

/**
 * 公開済みかを判定する。ビルド側の queryAvailablePosts と同じ規則。
 * 未公開・未来日付の記事を対象にすると、その slug が公開リポジトリのマニフェストに載り、
 * タイトルを描画した画像が公開バケットに置かれてしまう。
 */
export function isPublished(frontmatter: Record<string, unknown>): boolean {
  if (frontmatter.published !== true) {
    return false;
  }
  const createdTime = frontmatter.created_time;
  if (typeof createdTime !== 'string') {
    return false;
  }
  return new Date(createdTime).getTime() <= Date.now();
}

export function parseTarget(filePath: string, rootDir: string = process.cwd()): OgImageTarget {
  const frontmatter = readFrontmatter(filePath);

  const slug = frontmatter.slug;
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new Error(`${filePath} に slug がない`);
  }
  // ファイル名として書き出すため、ディレクトリを跨げる文字だけを拒む。
  // slug は Astro 側でURL生成に使われ文字種の制限がないので、ここで狭めると正当な記事を落とす
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    throw new Error(`${filePath} の slug "${slug}" はファイル名に使えない`);
  }
  // slug "og" の記事画像は public/images/og/ に置かれ、OG画像の出力先と重なる。
  // 出力先は gitignore されているため、その記事の画像だけが黙ってコミットされなくなる
  if (slug === OG_OUTPUT_DIR_NAME) {
    throw new Error(`${filePath} の slug "${slug}" はOG画像の出力先と衝突する`);
  }
  const title = frontmatter.title;
  if (typeof title !== 'string' || title.length === 0) {
    throw new Error(`${filePath} に title がない`);
  }
  const createdTime = frontmatter.created_time;
  if (typeof createdTime !== 'string') {
    throw new Error(`${filePath} に created_time がない`);
  }

  const locale = localeOf(filePath);
  const hash = computeOgImageHashFromFile(filePath, rootDir);
  return {
    filePath,
    slug,
    locale,
    title,
    publishedDate: new Date(createdTime),
    fileName: buildOgImageFileName(slug, locale, hash),
  };
}

/** sync の出力かどうか。手書きの記事とは不備への対処を変える */
export function isSyncOutput(filePath: string): boolean {
  return filePath.includes(join(CONTENT_DIR_NAME, NOTION_DIR_NAME));
}

/**
 * 公開記事なら生成対象に変換する。対象外なら null を返す。
 *
 * content/posts は手で書く再帰ツリーなので、frontmatter を持たないファイル (README 等) や
 * 記述の不備が紛れうる。1件で全体を止めず、記事として扱えないものは対象から外す。
 *
 * content/notion/posts は sync の出力であり、不備は異常である。黙って落とすと
 * その記事だけマニフェストから消え、OG画像を持たないまま公開されるため失敗させる。
 */
export function toTargetOrSkip(filePath: string, rootDir: string = process.cwd()): OgImageTarget | null {
  try {
    if (!isPublished(readFrontmatter(filePath))) {
      return null;
    }
    return parseTarget(filePath, rootDir);
  } catch (cause) {
    if (isSyncOutput(filePath)) {
      throw cause;
    }
    console.warn(`[og-image-sync] skip ${filePath}: ${(cause as Error).message}`);
    return null;
  }
}

async function listMarkdown(dir: string, recursive: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    // ディレクトリの不在だけを許容する。権限エラー等を空扱いにすると
    // 記事0件と誤認してマニフェストを空に切り詰めてしまう
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw cause;
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...(await listMarkdown(fullPath, recursive)));
      }
      continue;
    }
    if (entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** OG画像を持つべき記事ファイルを列挙する。ja/en 双方が対象 */
export async function listArticleFiles(contentDir: string): Promise<string[]> {
  const [notion, authored] = await Promise.all([
    listMarkdown(join(contentDir, NOTION_POSTS_DIR), false),
    listMarkdown(join(contentDir, AUTHORED_POSTS_DIR), true),
  ]);
  return [...notion, ...authored];
}

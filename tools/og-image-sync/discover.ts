import { readdir } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildOgImageFileName, computeOgImageHashFromFile } from '../../src/libs/og-image/hash.ts';

/** Notion sync の出力は flat、直接執筆はサブディレクトリを許す (src/content.config.ts と対称) */
export const CONTENT_DIR = 'content';
const NOTION_POSTS_DIR = 'notion/posts';
const AUTHORED_POSTS_DIR = 'posts';

/** OG画像の出力先ディレクトリ名。記事slugがこれと衝突すると画像の置き場が重なる */
export const OG_OUTPUT_DIR_NAME = 'og';

/**
 * 記事の記述自体の不備。手書きツリーではスキップの対象になる。
 * hash算出などツール側の失敗と区別するために型を分ける。区別しないと、
 * ツールのバグで記事が黙って落ちても警告しか出ない。
 */
export class ArticleValidationError extends Error {}

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
    throw new ArticleValidationError(`${filePath} に frontmatter がない`);
  }
  return parseYaml(match[1]) as Record<string, unknown>;
}

/**
 * 公開済みかを判定する。ビルド側の queryAvailablePosts と同じ規則。
 * 未公開・未来日付の記事を対象にすると、そのタイトルを描画した画像が公開バケットに置かれてしまう。
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

export function parseTarget(
  filePath: string,
  rootDir: string = process.cwd(),
  frontmatter: Record<string, unknown> = readFrontmatter(filePath),
): OgImageTarget {
  const slug = frontmatter.slug;
  if (typeof slug !== 'string' || slug.length === 0) {
    throw new ArticleValidationError(`${filePath} に slug がない`);
  }
  // ファイル名として書き出すため、ディレクトリを跨げる文字だけを拒む。
  // slug は Astro 側でURL生成に使われ文字種の制限がないので、ここで狭めると正当な記事を落とす
  if (slug.includes('/') || slug.includes('\\') || slug.includes('..')) {
    throw new ArticleValidationError(`${filePath} の slug "${slug}" はファイル名に使えない`);
  }
  // slug "og" の記事画像は public/images/og/ に置かれ、OG画像の出力先と重なる。
  // 出力先は gitignore されているため、その記事の画像だけが黙ってコミットされなくなる
  if (slug === OG_OUTPUT_DIR_NAME) {
    throw new ArticleValidationError(`${filePath} の slug "${slug}" はOG画像の出力先と衝突する`);
  }
  const title = frontmatter.title;
  if (typeof title !== 'string' || title.length === 0) {
    throw new ArticleValidationError(`${filePath} に title がない`);
  }
  const createdTime = frontmatter.created_time;
  if (typeof createdTime !== 'string') {
    throw new ArticleValidationError(`${filePath} に created_time がない`);
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
  return filePath.includes(NOTION_POSTS_DIR);
}

/**
 * 公開記事なら生成対象に変換する。対象外なら null を返す。
 *
 * content/posts は手で書く再帰ツリーなので、frontmatter を持たないファイル (README 等) や
 * 記述の不備が紛れうる。1件で全体を止めず、記事として扱えないものは対象から外す。
 *
 * content/notion/posts は sync の出力であり、不備は異常である。黙って落とすと
 * その記事だけOG画像を持たないまま公開されるため失敗させる。
 */
export function toTargetOrSkip(filePath: string, rootDir: string = process.cwd()): OgImageTarget | null {
  try {
    // 同じファイルを2度読まないよう、判定に使った frontmatter をそのまま渡す
    const frontmatter = readFrontmatter(filePath);
    if (!isPublished(frontmatter)) {
      return null;
    }
    return parseTarget(filePath, rootDir, frontmatter);
  } catch (cause) {
    // 記事の不備でない失敗 (hash算出の異常など) はツール側の問題なので握りつぶさない
    if (isSyncOutput(filePath) || !(cause instanceof ArticleValidationError)) {
      throw cause;
    }
    console.warn(`[og-image-sync] skip ${filePath}: ${cause.message}`);
    return null;
  }
}

export interface ResolvedRequest {
  /** 生成対象になるファイルの絶対パス */
  files: string[];
  /** 対象にならなかった入力。呼び出し側が気付けるよう内訳を残す */
  dropped: string[];
}

/**
 * 呼び出し側から渡されたパスを生成対象に整える。
 *
 * 呼び出し側 (blog-contents の sync) は作業ツリーの差分をそのまま渡すため、
 * 削除された記事や記事以外の出力 (tags.json 等) が混ざる。1件で全体を止めないよう、
 * 対象になりえないものはここで落とす。別リポジトリから呼ばれるので絶対パスも受ける。
 */
export function resolveRequestedFiles(paths: string[], rootDir: string = process.cwd()): ResolvedRequest {
  const contentDir = join(rootDir, CONTENT_DIR) + sep;
  const files = new Set<string>();
  const dropped: string[] = [];
  for (const path of paths) {
    const absolute = resolve(isAbsolute(path) ? path : join(rootDir, path));
    // content 配下に限る。任意の .md を受けると、実在しない記事の画像が公開バケットに載る
    if (!absolute.startsWith(contentDir) || !absolute.endsWith('.md') || !existsSync(absolute)) {
      dropped.push(path);
      continue;
    }
    files.add(absolute);
  }
  return { files: [...files], dropped };
}

/**
 * 渡された対象の中で同じ slug と locale が2つあれば落とす。
 * 黙って両方を描くと、片方が参照されないままR2に残る。
 *
 * 見るのは渡された範囲だけなので、更新されていない記事との衝突は検出できない。
 * 全体の一意性はビルド時の assertUniqueSlugs が保証する。
 */
export function assertUniqueTargets(targets: OgImageTarget[]): void {
  const seen = new Map<string, OgImageTarget>();
  for (const target of targets) {
    const key = `${target.locale}:${target.slug}`;
    const existing = seen.get(key);
    if (existing) {
      throw new Error(
        `slug "${target.slug}" (locale: ${target.locale}) が重複している:\n  ${existing.filePath}\n  ${target.filePath}`,
      );
    }
    seen.set(key, target);
  }
}

async function listMarkdown(dir: string, recursive: boolean): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    // ディレクトリの不在だけを許容する。権限エラー等を空扱いにすると
    // 記事0件と誤認し、何も生成しないまま成功したように見えてしまう
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

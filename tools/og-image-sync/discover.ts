import { readdir } from 'node:fs/promises';
import { lstatSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { buildOgImageFileName, computeOgImageHashFromFile } from '../../src/libs/og-image/hash.ts';

/** Notion sync の出力は flat、直接執筆はサブディレクトリを許す (src/content.config.ts と対称) */
export const CONTENT_DIR = 'content';
const NOTION_POSTS_DIR = 'notion/posts';
const AUTHORED_POSTS_DIR = 'posts';

/** OG画像のR2キー接頭辞。記事slugがこれと衝突すると名前空間が重なる */
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
 * 記事として配信されうるかを判定する。
 *
 * 公開日は見ない。日付が到来しても記事に差分は出ないため生成が起動せず、
 * サイトだけが公開されてOG画像が404になる。予約投稿でも先に描いておく。
 *
 * ビルド側の queryAvailablePosts は `published && isPast` で絞るが、あれはURL生成の判定であり、
 * 画像を用意しておくかどうかとは別の関心である。
 *
 * なお sync は Notion 側で published のものだけを取得するため (queryFilter)、
 * content/notion/posts に未公開記事は現れない。この判定は手書きツリー向けの保険である。
 */
export function isPublished(frontmatter: Record<string, unknown>): boolean {
  return frontmatter.published === true;
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
  // R2 では記事画像 `<slug>/<file>` と OG画像 `og/<file>` が同じ名前空間に入る。
  // ここで止めるのは sync の出力だけで、手書きの記事は対象外にするだけである
  // (記事画像の置き場 public/images/og/ は ignore されたままなので、
  //  そちらの記事の画像は結局コミットされない)
  if (slug === OG_OUTPUT_DIR_NAME) {
    throw new ArticleValidationError(`${filePath} の slug "${slug}" はOG画像のR2キー接頭辞と衝突する`);
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

/** rootDir 基準で絶対パスにする。基準を取り違えると範囲判定が丸ごとずれる */
function toAbsolutePath(path: string, rootDir: string = process.cwd()): string {
  return resolve(isAbsolute(path) ? path : join(rootDir, path));
}

/**
 * 実体のパスに揃える。
 *
 * 呼び出し側は別リポジトリから絶対パスを渡すため、symlink を経た形になりうる
 * (macOS の /var → /private/var など)。文字列のまま比べると同じ場所を別物と判定する。
 */
function toRealPath(path: string, rootDir: string = process.cwd()): string {
  const absolute = toAbsolutePath(path, rootDir);
  // 末端は解決しない。記事そのものが symlink の場合に、実体の置き場所で範囲を判定すると
  // notion 配下の記事が範囲外に見えて黙って落ちる。目的は /var → /private/var のような
  // 途中経路の差を吸収することなので、親だけを解決すれば足りる
  return join(resolveBestEffort(dirname(absolute)), basename(absolute));
}

/** ディレクトリの基準。末端まで解決する。ファイルと違い symlink 自体が対象ではない */
function toRealDir(path: string): string {
  return resolveBestEffort(path);
}

/** 実体をそのまま解決する。存在しなければ null */
function resolveExact(path: string): string | null {
  try {
    return realpathSync.native(path);
  } catch {
    return null;
  }
}

/**
 * 実在する祖先まで遡って解決し、残りは字句のまま繋ぐ。
 *
 * 不在のパスも渡る (削除された記事など)。権限エラーなども同じく遡る。ここで投げると
 * 1件の失敗で無関係な記事の生成まで止まる。
 */
function resolveBestEffort(path: string): string {
  const absolute = resolve(path);
  const tail: string[] = [];
  let current = absolute;
  for (;;) {
    const resolved = resolveExact(current);
    if (resolved !== null) {
      return join(resolved, ...tail.slice().reverse());
    }
    const parent = dirname(current);
    if (parent === current) {
      return absolute;
    }
    tail.push(basename(current));
    current = parent;
  }
}

/**
 * パスの状態。投げない。不在と「あるが読めない」を呼び出し側で分けるため。
 *
 * 読めないだけの記事を「削除された」と分類すると、sync の出力ならその記事が
 * OG画像を持たないまま公開される。一方で手書きツリーは不備が混ざる前提なので、
 * 同じ状態でも1件で全体を止めない。判断も報告も呼び出し側に任せる
 * (ここで警告すると、同じパスを見るたびに同じ行が出る)。
 */
type EntryState = 'exists' | 'absent' | 'unreadable';

function entryStateOf(path: string): EntryState {
  try {
    statSync(path);
    return 'exists';
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    if (code === 'ENOENT' || code === 'ENOTDIR') {
      return 'absent';
    }
    return 'unreadable';
  }
}

/** ディレクトリを指すか。辿った先で判定する */
function isDirectorySync(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** パスとしての入口があるか。実体を失った symlink は true、削除された記事は false */
function isEntryPresent(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * notion 出力ディレクトリの実体。
 *
 * 覚えない。プロセス内で複数の root を扱うとき、消えた root のパスを後から別の root が
 * 引き当てると古い実体を返し、全記事が範囲外と判定される。
 */
function notionDirOf(rootDir: string): string {
  return toRealDir(resolve(rootDir, CONTENT_DIR, NOTION_POSTS_DIR));
}

/** 外に出ているか。外に出るパスは必ず区切りを含むか `..` そのものになる */
function isOutside(rel: string): boolean {
  return rel === '' || rel === '..' || rel.startsWith('..' + sep) || isAbsolute(rel);
}

/**
 * sync の出力かどうか。手書きの記事とは不備への対処を変える。
 *
 * 部分一致で見ないのは、チェックアウト先の親に `notion/posts` を含むパス
 * (例: `~/notion/posts/blog.lacolaco.net`) だと手書きの記事まで sync 出力と誤判定するため。
 *
 * 対象は直下のファイルに限る。resolveRequestedFiles の範囲と揃える。
 * 区切りの有無で見るのは、`..foo.md` のような名前を親への参照と取り違えないため。
 */
function isSyncOutput(filePath: string, rootDir: string): boolean {
  return isSyncOutputReal(toRealPath(filePath, rootDir), rootDir);
}

/** 解決済みのパスで判定する。呼び出し側が既に実体を持っているときに使う */
function isSyncOutputReal(real: string, rootDir: string): boolean {
  const rel = relative(notionDirOf(rootDir), real);
  return !isOutside(rel) && !rel.includes(sep);
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
    if (isSyncOutput(filePath, rootDir) || !(cause instanceof ArticleValidationError)) {
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
  // listArticleFiles と同じ範囲に限る。ずれると、個別指定でだけ描かれて
  // サイトが参照しない画像が公開バケットに残る
  // isSyncOutput と同じ正規化を通す。ここで基準がずれると、呼び出し側が symlink を経た
  // パスを渡しただけで全件が対象外になる
  const authoredDir = toRealDir(resolve(rootDir, CONTENT_DIR, AUTHORED_POSTS_DIR)) + sep;

  // 実体で重複を除く。同じ記事を2つの形で渡されたときに2件とも残すと、
  // assertUniqueTargets が slug の重複として全体を落とし、原因を取り違えさせる。
  // 値は渡された形のままにして、呼び出し側の見え方を変えない
  const files = new Map<string, string>();
  const dropped: string[] = [];
  // 1件ずつ投げると、直すたびに次の1件で落ちる。まとめて報告する
  const unreadable: string[] = [];
  const directories: string[] = [];
  for (const path of paths) {
    const absolute = toAbsolutePath(path, rootDir);
    // 範囲の判定だけ実体で行う。返すのは絶対パスにした入力で、symlink は解決しない。
    // 解決して返すと、locale をファイル名から決めている前提 (localeOf) と食い違う
    const real = toRealPath(absolute, rootDir);
    // notion/posts は flat、posts は再帰。listArticleFiles の非対称性に合わせる。
    // notion 側は isSyncOutput に判定を委ねる。同じ規則を2か所に書くとずれる。
    //
    // 手書き側は実体で判定するため、content/posts の下に外を指す symlink ディレクトリが
    // あるとその中の記事は対象外になる。listArticleFiles も symlink を辿らないので、
    // --all と個別指定で結果が変わらない
    const inScope = isSyncOutputReal(real, rootDir) || real.startsWith(authoredDir);
    // 状態は1回だけ調べる。分岐ごとに調べると警告が重複し、CI のログでは
    // 別々の記事が壊れているように見える。
    // 親ディレクトリの権限で読めない場合は lstat も失敗するため、入口の有無は問わない
    const state = entryStateOf(absolute);
    // `*.md` という名前でもディレクトリ (やその symlink) のことがある。
    // 記事として読むと EISDIR で落ちる。notion 配下なら sync の異常として止め、
    // 手書きツリーなら対象外にする
    if (absolute.endsWith('.md') && isDirectorySync(absolute)) {
      if (isSyncOutputReal(real, rootDir)) {
        directories.push(path);
      } else {
        dropped.push(path);
      }
      continue;
    }
    // 削除された記事は不在、実体を失った symlink や読めない記事は「入口はあるが読めない」。
    // 後者が sync の出力なら異常なので、まとめて報告するために積む
    if (
      absolute.endsWith('.md') &&
      isSyncOutputReal(real, rootDir) &&
      (state === 'unreadable' || (state === 'absent' && isEntryPresent(absolute)))
    ) {
      unreadable.push(path);
      continue;
    }
    if (state === 'unreadable') {
      console.warn(`[og-image-sync] ${path} を確認できない`);
    }
    if (!inScope || !absolute.endsWith('.md') || state !== 'exists') {
      dropped.push(path);
      continue;
    }
    // 先勝ちにする。後勝ちだと、同じ実体を2つの形で渡されたときにどちらが返るか定まらず、
    // ログやエラー文がリポジトリ外のパスを指すことがある
    if (!files.has(real)) {
      files.set(real, absolute);
    }
  }
  // 種類ごとに投げ分けると、片方を直したあとにもう片方で落ちる。1回にまとめる
  const anomalies = [
    ...(directories.length > 0 ? [`notion の出力にディレクトリがある: ${directories.join(' ')}`] : []),
    ...(unreadable.length > 0 ? [`sync が書き出した記事を読めない: ${unreadable.join(' ')}`] : []),
  ];
  if (anomalies.length > 0) {
    throw new Error(anomalies.join('\n'));
  }

  return { files: [...files.values()], dropped };
}

/**
 * 渡されたパスが1件も対象にならなかったら失敗させる。
 *
 * 呼び出し側 (blog-contents の sync) は blog-content.config.yaml の postsDir を基準に
 * パスを集めるが、こちらは CONTENT_DIR と NOTION_POSTS_DIR を持っている。設定を変えると
 * 両者がずれ、全件が dropped に落ちて警告だけを出して正常終了する。
 * 記事は同期されOG画像だけが欠けたまま公開されるため、警告では足りない。
 *
 * 同じ条件は「渡された記事がすべて消えている」でも成立する。依頼から実行までの間に
 * 記事が削除された場合などで、原因が違うので文言に併記する。
 *
 * 記事以外しか渡されなかった回は見ない。tags.json の更新だけ、という同期は正常であり、
 * 「基準がずれている」と区別できないまま止めると、無関係な変更で同期が落ちる。
 *
 * 一部だけ落ちるのは正常 (削除された記事など) なので、全件のときだけ止める。
 */
export function assertRequestResolved(requested: string[], resolved: ResolvedRequest): void {
  // 記事になりうる入力が1件も無い回は、描くものが無くて当然である。呼び出し側は
  // 作業ツリーの差分をそのまま渡すため、tags.json の更新だけ、という回がある
  const articleLike = requested.filter((path) => path.endsWith('.md'));
  if (articleLike.length > 0 && resolved.files.length === 0) {
    throw new Error(
      `指定された ${articleLike.length} 件の記事がすべて対象外になった。` +
        `パスの基準がずれているか、渡された記事がすべて消えている: ${resolved.dropped.join(' ')}`,
    );
  }
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

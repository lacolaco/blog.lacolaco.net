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
 * OG画像を持たないまま公開される。一方で手書きツリーは1件の不備で全体を止めない。
 * 扱いを変えるのは呼び出し側なので、ここでは区別だけを作る
 * (ここで警告すると、同じパスを見るたびに同じ行が出る)。
 */
type EntryState = 'exists' | 'absent' | 'unreadable';

/** 状態と、そう判断した理由。理由を後から取り直すと、その間に状況が変わって食い違う */
interface EntryStatus {
  state: EntryState;
  code?: string;
}

function statusOf(path: string): EntryStatus {
  try {
    statSync(path);
    return { state: 'exists' };
  } catch (cause) {
    const code = (cause as NodeJS.ErrnoException).code;
    // ENOTDIR は親がディレクトリでないという意味で、削除とは違う。absent に混ぜると
    // 個別指定だけが「記事が消えている」と報告し、--all の診断と原因の帰属がずれる
    if (code === 'ENOENT') {
      return { state: 'absent', code };
    }
    return { state: 'unreadable', code };
  }
}

function entryStateOf(path: string): EntryState {
  return statusOf(path).state;
}

/** ディレクトリを指すか。辿った先で判定する */
function isDirectorySync(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** 記事として扱えなかったもの。種類ごとに分けて持ち、呼び出し側が扱いを決める */
interface WalkAnomalies {
  /** 読めなかったツリーの根。1件の不備ではなく、そのツリーの記事が丸ごと落ちる */
  roots: string[];
  directories: string[];
  unreadable: string[];
  unlistable: string[];
  /** 実体を失った symlink。指す先の種別は分からないので、ディレクトリとは別に持つ */
  danglingLinks: string[];
  /** 実体はあるが辿れない symlink。消えたわけではないので、上とは別に持つ */
  unresolvableLinks: string[];
  /** 記事でないのに読めなかった入力。記事の不備ではないので、文面を分ける */
  unreadableInputs: string[];
}

function emptyAnomalies(): WalkAnomalies {
  return {
    roots: [],
    directories: [],
    unreadable: [],
    unlistable: [],
    danglingLinks: [],
    unresolvableLinks: [],
    unreadableInputs: [],
  };
}

/**
 * 異常の文面を1か所で作る。経路ごとに書くと同じ状態が別の言葉で報告される。
 *
 * どのツリーの話かを引数で受ける。フィールドだけでは判別できず、手書きツリーの分を
 * notion の出力として報告してしまう。失敗させるか知らせるだけかは呼び出し側が決める
 */
function anomalyMessages(anomalies: Partial<WalkAnomalies>, tree: 'sync' | 'authored' | 'outside'): string[] {
  const where = { sync: 'notion の出力', authored: '手書きツリー', outside: '対象範囲の外' }[tree];
  const {
    roots = [],
    directories = [],
    unreadable = [],
    unlistable = [],
    danglingLinks = [],
    unresolvableLinks = [],
    unreadableInputs = [],
  } = anomalies;
  return [
    ...(roots.length > 0 ? [`${where}の記事の置き場所を読めない: ${roots.join(' ')}`] : []),
    ...(directories.length > 0 ? [`${where}に記事の名前のディレクトリがある: ${directories.join(' ')}`] : []),
    ...(unlistable.length > 0 ? [`${where}のディレクトリを読めない: ${unlistable.join(' ')}`] : []),
    ...(danglingLinks.length > 0 ? [`${where}に実体を失った symlink がある: ${danglingLinks.join(' ')}`] : []),
    ...(unresolvableLinks.length > 0 ? [`${where}に辿れない symlink がある: ${unresolvableLinks.join(' ')}`] : []),
    ...(unreadableInputs.length > 0 ? [`${where}の記事でないパスを読めない: ${unreadableInputs.join(' ')}`] : []),
    ...(unreadable.length > 0
      ? [`${where}の記事を読めない (削除ではなく、読み取りに失敗した): ${unreadable.join(' ')}`]
      : []),
  ];
}

/**
 * パスの実体が何かを分類する。記事かどうかは名前で決まるので、ここでは判断しない。
 * `present` は実体に届いたという意味で、開けることまでは保証しない (権限で読めない
 * 通常のファイルは readFrontmatter の失敗として止まる)。
 *
 * 個別指定と `--all` の双方がこれを使う。同じ規則を2か所に書くと、片方だけ直したときに
 * 「個別指定は止まるのに `--all` は黙って記事を落とす」というずれが生まれる。
 */
type EntryKind = 'present' | 'directory' | 'unreadable' | 'missing';

function classifyEntry(path: string, stopAt: string): EntryKind {
  // ディレクトリを先に見る。記事として読むと EISDIR で落ちる
  if (isDirectorySync(path)) {
    return 'directory';
  }
  const state = entryStateOf(path);
  // 削除された記事は不在、実体を失った symlink や読めない記事は「入口はあるが読めない」
  if (state === 'unreadable' || (state === 'absent' && isEntryPresent(path))) {
    return 'unreadable';
  }
  // 記事の不在は、置き場所そのものに届かないせいかもしれない。それを削除と読むと、
  // 環境側の失敗を記事の削除に帰属させてしまう。
  // 親の不在は含めない。ディレクトリごと記事を消すのは正常な差分であり、
  // それで止めると sync が渡す作業ツリーの差分をそのまま扱えなくなる
  if (state === 'absent' && isUnreachableDir(dirname(path), stopAt)) {
    return 'unreadable';
  }
  return state === 'exists' ? 'present' : 'missing';
}

/**
 * 置き場所に届かないか。読めないディレクトリと、実体を失った symlink のディレクトリを指す。
 * 単に消えたディレクトリは含めない (記事の削除と区別できないため)
 */
function isUnreachableDir(dir: string, stopAt: string): boolean {
  // 実体のある祖先に届くまで遡る。1階層しか見ないと、届かない置き場所が
  // 2階層以上上にあるときに記事の削除と読み違える。
  // リポジトリの外までは遡らない。外の事情で記事の削除を「読めない」と読み替えない
  for (let current = dir; ; current = dirname(current)) {
    if (isOutside(relative(stopAt, current))) {
      return false;
    }
    const state = entryStateOf(current);
    if (state === 'unreadable' || (state === 'absent' && isEntryPresent(current))) {
      return true;
    }
    if (state === 'exists' || dirname(current) === current) {
      return false;
    }
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
 * 削除された記事や記事以外の出力 (tags.json 等) が混ざる。これらは対象外にするだけで、
 * 1件で全体を止めない。読めない記事とディレクトリは環境側の失敗だが、止めるのは
 * sync の出力の場合だけである。別リポジトリから呼ばれるので絶対パスも受ける。
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
  // 止めずに知らせるだけのもの。ツリーごとに分けて、報告の言葉を列挙と揃える
  const syncSkipped: WalkAnomalies = emptyAnomalies();
  const authoredSkipped: WalkAnomalies = emptyAnomalies();
  const outsideSkipped: WalkAnomalies = emptyAnomalies();
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
    // --all と個別指定で結果が変わらない。
    // 内を指す symlink 経由で渡された記事は対象になるが、--all も実体の側で同じ記事を
    // 拾う (slug はファイル名から決まる)。どちらの経路でも同じ画像になる
    const inScope = isSyncOutputReal(real, rootDir) || real.startsWith(authoredDir);
    // 不在と「あるが読めない」を分ける。この2つを同じ扱いにすると、
    // 読めないだけの記事を削除された記事として黙って落とす
    const kind = classifyEntry(absolute, rootDir);
    const isArticlePath = absolute.endsWith('.md');
    // ディレクトリは sync の出力なら異常。手書きツリーでは中の記事が別途対象になる
    if (isArticlePath && kind === 'directory' && isSyncOutputReal(real, rootDir)) {
      directories.push(path);
      continue;
    }
    // 読めない記事は sync の出力でだけ失敗させる。握りつぶすと公開済みの記事が
    // OG画像を持たないまま緑で通るためである。手書きツリーは対象外にして知らせるだけにする。
    // 列挙 (listArticleFiles) は読めないディレクトリを手書きツリーでも止めるが、あちらは
    // その下の記事が丸ごと落ちることを観測できる。こちらは渡された1件しか見えない
    if (isArticlePath && isSyncOutputReal(real, rootDir) && kind === 'unreadable') {
      unreadable.push(path);
      continue;
    }
    if (!inScope || !isArticlePath || kind !== 'present') {
      // 対象外の内訳にも並ぶが、そこでは tags.json の混入 (正常) と
      // 権限の異常が同じ行に並ぶ。なぜ落としたかを言えるのはこちらだけである。
      // 文面は列挙 (listArticleFiles) と共通にして、経路で言葉が変わらないようにする
      // どのツリーの話かで文面が変わる。inScope で分けると、sync の出力の異常を
      // 手書きツリーの不備として報告してしまう。
      // sync の出力でここに来るのは記事でないパスだけである (記事の異常は手前で止まる)
      const skipped = isSyncOutputReal(real, rootDir) ? syncSkipped : inScope ? authoredSkipped : outsideSkipped;
      if (kind === 'unreadable') {
        // 記事かどうかで文面を分ける。tags.json の混入は正常だが、読めないのは異常である
        (isArticlePath ? skipped.unreadable : skipped.unreadableInputs).push(path);
      } else if (isArticlePath && kind === 'directory') {
        skipped.directories.push(path);
      }
      dropped.push(path);
      continue;
    }
    // 先勝ちにする。後勝ちだと、同じ実体を2つの形で渡されたときにどちらが返るか定まらず、
    // ログやエラー文がリポジトリ外のパスを指すことがある
    if (!files.has(real)) {
      files.set(real, absolute);
    }
  }
  // 止めないものを先に出す。あとの throw より後ろに置くと、
  // sync の出力の異常と重なったときにこちらの診断だけが消える
  for (const message of [
    ...anomalyMessages(syncSkipped, 'sync'),
    ...anomalyMessages(authoredSkipped, 'authored'),
    ...anomalyMessages(outsideSkipped, 'outside'),
  ]) {
    console.warn(`[og-image-sync] 対象外にした: ${message}`);
  }

  // 種類ごとに投げ分けると、片方を直したあとにもう片方で落ちる。1回にまとめる
  const anomalies = anomalyMessages({ directories, unreadable }, 'sync');
  if (anomalies.length > 0) {
    // 対象外の内訳も添える。ここで投げると main の要約に届かず、
    // 「他の全件も落ちていた」という診断に効く情報が消える
    if (dropped.length > 0) {
      anomalies.push(`${dropped.length} 件を対象外にした: ${dropped.join(' ')}`);
    }
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

/**
 * markdown を列挙する。
 *
 * `*.md` という名前でもディレクトリだったり実体を失っていたりする。名前だけで記事とすると
 * 読み込みが EISDIR や ENOENT で落ち、記事の不備ではないため全体が止まる。
 * 個別指定 (resolveRequestedFiles) と同じ分類をここでも行い、経路で扱いを変えない。
 */
async function listMarkdown(
  dir: string,
  recursive: boolean,
  anomalies: WalkAnomalies,
  isRoot = false,
): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (cause) {
    // ディレクトリの不在だけを許容する。権限エラー等を空扱いにすると
    // 記事0件と誤認し、何も生成しないまま成功したように見えてしまう。
    // 実体を失った symlink も readdir は ENOENT を返すが、これは不在ではない。
    // 入口が残っているので lstat で区別する (classifyEntry と同じ規準)
    const code = (cause as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT' || isEntryPresent(dir)) {
      // ここで throw すると、この後に列挙されるはずだった異常が消える。
      // どのディレクトリが読めなかったかは呼び出し側がまとめて報告する。
      // errno を残す。恒久的な権限の問題 (EACCES) と一過性の枯渇 (EMFILE) を取り違えない
      (isRoot ? anomalies.roots : anomalies.unlistable).push(`${dir} (${code ?? 'unknown'})`);
    }
    return [];
  }

  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    // 実体のディレクトリは名前を問わず再帰の対象。`foo.md` という名前でも、
    // その中の記事は個別指定なら対象になる。ここで下を見ないと --all だけ記事が欠ける
    if (entry.isDirectory()) {
      if (recursive) {
        files.push(...(await listMarkdown(fullPath, recursive, anomalies)));
      } else if (entry.name.endsWith('.md')) {
        // 記事の名前で記事でない。個別指定も同じものを異常として扱う
        anomalies.directories.push(fullPath);
      }
      // 記事でない名前のディレクトリは、flat なツリーでは個別指定も黙って落とす。
      // ここで異常にすると経路差になるので、何もしない
      continue;
    }
    if (!entry.name.endsWith('.md')) {
      // 実体を失った symlink は、その先がディレクトリだったなら中の記事ごと消える。
      // 隠れうるのは再帰するツリーだけなので、flat なツリーでは異常にしない。
      // 種別は実体がないので分からず、止めると記事と無関係な1件で生成全体が落ちる
      if (recursive && entry.isSymbolicLink()) {
        // 実体を失ったものと、実体はあるが辿れないものを分ける。混ぜると、
        // 権限で届かないだけの symlink を「消えた」と報告して探す先を誤らせる
        const { state, code } = statusOf(fullPath);
        if (state === 'absent') {
          anomalies.danglingLinks.push(fullPath);
        } else if (state === 'unreadable') {
          // 判断の根拠になった理由をそのまま残す。readdir の失敗と同じ形にして突き合わせられるようにする
          anomalies.unresolvableLinks.push(`${fullPath} (${code ?? 'unknown'})`);
        }
      }
      continue;
    }
    // 通常のファイルは dirent で確定する。記事ごとに stat を足すと --all で全記事分になる
    if (entry.isFile()) {
      files.push(fullPath);
      continue;
    }
    // 親は readdir が通っている。祖先の遡りは即座に終わる
    const kind = classifyEntry(fullPath, dir);
    if (kind === 'directory') {
      anomalies.directories.push(fullPath);
      continue;
    }
    if (kind === 'unreadable') {
      anomalies.unreadable.push(fullPath);
      continue;
    }
    // 列挙と分類の間に消えた記事は落とすだけにする。個別指定も不在は対象外にする
    if (kind === 'present') {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * OG画像を持つべき記事ファイルを列挙する。ja/en 双方が対象。
 *
 * 列挙の途中で見つけた異常は、sync の出力なら失敗させる。手書きツリーは対象外にして
 * 知らせるだけにする。sync の出力は記事が欠けたまま公開されるのを防ぐ必要があり、
 * 手書きツリーは1件の不備で生成全体を止める理由がない。
 * 手書きツリーは空でもよいが、sync の出力が空なのは異常である。
 * 個別指定 (resolveRequestedFiles) と同じ扱いにする。
 */
export async function listArticleFiles(contentDir: string): Promise<string[]> {
  const notionAnomalies = emptyAnomalies();
  const authoredAnomalies = emptyAnomalies();
  // listMarkdown は途中で投げない。異常を積んで最後まで歩くので、
  // 片方の失敗でもう片方の診断が消えることはない
  const [notion, authored] = await Promise.all([
    listMarkdown(join(contentDir, NOTION_POSTS_DIR), false, notionAnomalies, true),
    listMarkdown(join(contentDir, AUTHORED_POSTS_DIR), true, authoredAnomalies, true),
  ]);

  // 対象外にしたものを先に出す。あとの throw より後ろに置くと、
  // 読めない記事と重なったときにこちらの診断だけが消える。
  // 根が読めない場合はツリーごと落ちるので、知らせるだけにせず下で失敗させる
  const skipped = anomalyMessages({ ...authoredAnomalies, roots: [], unlistable: [] }, 'authored');
  for (const message of skipped) {
    console.warn(`[og-image-sync] 対象外にした: ${message}`);
  }

  // 止めるのは sync の出力だけ。記事が欠けたまま公開されるのを防ぐ必要があるためである。
  // 手書きツリーは上で対象外として知らせるだけにする (個別指定も同じ規準)
  const messages = [
    ...anomalyMessages(notionAnomalies, 'sync'),
    // 読めないディレクトリは両ツリーで異常。1件の不備ではなく、その下の記事が丸ごと落ちる
    ...anomalyMessages({ roots: authoredAnomalies.roots, unlistable: authoredAnomalies.unlistable }, 'authored'),
  ];
  if (messages.length > 0) {
    throw new Error(messages.join('\n'));
  }

  // 記事の有無で見る。ディレクトリの存在だけを見ると、空のときに通り抜ける。
  // 手書きツリーだけが残っていると記事0件にならないため、ここで見ないと
  // Notion 記事を全件落としたまま成功してしまう (main にあった0件ガードはこれに置き換えた)。
  // 読めなかった場合は手前の報告が先に出るので、ここには不在と空だけが来る
  if (notion.length === 0) {
    throw new Error(`${join(contentDir, NOTION_POSTS_DIR)} に記事が1件もない。実行位置とチェックアウトを確認する`);
  }

  return [...notion, ...authored];
}

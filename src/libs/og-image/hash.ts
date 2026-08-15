import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';

/**
 * OG画像の描画結果を左右する実装ファイル。
 * 手動のバージョン番号だと更新漏れに気付けない (R2オブジェクトはイミュータブルなため、
 * hashが変わらなければ古い描画が永久に配信され続ける) ので、内容そのものをhashの入力にする。
 * generate.ts は画像に描かれるサイトのドメイン名を保持するため対象に含める。
 */
export const RENDERER_SOURCE_FILES = [
  'src/libs/og-image/image.tsx',
  'src/libs/og-image/generate.ts',
  'src/libs/og-image/avatar.png',
  'src/libs/og-image/font-loader.ts',
] as const;

/**
 * 描画結果を左右する依存。バージョンが変わるとグリフ配置や分節が変わりうるため指紋の入力に含める。
 * package.json の宣言は caret レンジ (例: satori の `^0.28.0`) を含み、lockfileだけが更新された
 * ケースを取りこぼす。node_modules の実バージョンも環境ごとにずれうるため、
 * リポジトリにコミットされた lockfile の解決済みバージョンを唯一の出所とする。
 *
 * 解決済みバージョンに加えて lockfile の snapshot (その依存が直接引き込む依存の一覧) も入力にする。
 * satori のレイアウトエンジンや字形整形は yoga-layout / @shuding/opentype.js / linebreak が担っており、
 * satori 自身のバージョンが動かないまま推移的依存だけが更新されると描画が変わるため。
 *
 * 捕捉できるのは1階層下までで、推移的閉包ではない。例えば @shuding/opentype.js が引き込む fflate の
 * 更新は指紋に現れない。lockfile 全体をハッシュすれば取りこぼしはなくなるが、無関係な依存更新のたびに
 * 全記事が再生成されるので採らない。
 */
export const RENDERER_DEPENDENCIES = ['satori', '@resvg/resvg-js', 'budoux', 'date-fns', '@date-fns/tz'] as const;

const LOCKFILE = 'pnpm-lock.yaml';

/**
 * 指紋が捕捉できない変更が一つある。font-loader.ts は生成のたびにGoogle Fonts へ
 * フォントを取りに行くため、Google側でグリフやhintingが更新されても指紋は変わらない。
 * 描画が変わったのに再生成されない状況になったら、RENDERER_SOURCE_FILES のいずれかを
 * 編集すれば全記事の再生成を強制できる。
 */

/** 既存の画像ファイル (`<name>.<hash>.<ext>`) と桁数を揃える */
const HASH_LENGTH = 16;

/** ビルド時専用であることを呼び出し側に伝えるためのエラー */
function rendererInputError(path: string, cause: unknown): Error {
  return new Error(
    `OG画像の指紋を算出できない: ${path} を読めなかった。この関数はリポジトリのソースを参照するためビルド時にのみ使える`,
    { cause },
  );
}

function readRendererInput(path: string): Buffer {
  try {
    return readFileSync(path);
  } catch (cause) {
    throw rendererInputError(path, cause);
  }
}

type LockfileEntry = { version: string; snapshot: string };

/**
 * lockfile から描画に関わる依存の解決済みバージョンと推移的依存の集合を読む。
 * 読めなかった場合に空文字へフォールバックすると依存の更新を検知できなくなり、
 * 古い描画が永久に配信され続けるため、必ず失敗させる。
 */
function readLockfileEntries(raw: string, lockfilePath: string): Record<string, LockfileEntry> {
  const lockfile = parseYaml(raw) as {
    importers?: Record<string, { [section: string]: Record<string, { version?: string }> | undefined }>;
    snapshots?: Record<string, unknown>;
  };
  const importer = lockfile.importers?.['.'];
  if (!importer) {
    throw new Error(`${lockfilePath} から importers['.'] を読めなかった。lockfileの形式が変わった可能性がある`);
  }

  // 生成はビルド時にしか走らないため、依存がどのセクションで宣言されていても等しく扱う
  const declared: Record<string, { version?: string }> = {
    ...importer.dependencies,
    ...importer.devDependencies,
    ...importer.optionalDependencies,
  };

  const entries: Record<string, LockfileEntry> = {};
  for (const name of RENDERER_DEPENDENCIES) {
    const version = declared[name]?.version;
    if (!version) {
      throw new Error(`${lockfilePath} に ${name} の解決済みバージョンがない。指紋が依存の更新を検知できなくなる`);
    }
    const snapshotKey = `${name}@${version}`;
    const snapshot = lockfile.snapshots?.[snapshotKey];
    if (snapshot === undefined) {
      throw new Error(
        `${lockfilePath} に snapshots['${snapshotKey}'] がない。指紋が推移的依存の更新を検知できなくなる`,
      );
    }
    entries[name] = { version, snapshot: JSON.stringify(snapshot) };
  }
  return entries;
}

/**
 * lockfile のパース結果だけを覚えておく。264KBのYAMLを記事数だけパースし直すと遅いが、
 * 指紋そのものを覚えると実装ファイルの編集を取りこぼすため、キャッシュはここに限る。
 *
 * キーは内容そのもののハッシュにする。バージョンだけの書き換え (`1.0.0` → `1.0.1`) は
 * バイト長が変わらないため、mtimeとサイズによる判定では粗いmtime粒度の環境で取りこぼしうる。
 */
let lockfileCache: { path: string; key: string; entries: Record<string, LockfileEntry> } | null = null;

function loadLockfileEntries(lockfilePath: string): Record<string, LockfileEntry> {
  const raw = readRendererInput(lockfilePath);
  const key = createHash('sha256').update(raw).digest('hex');
  if (lockfileCache?.path === lockfilePath && lockfileCache.key === key) {
    return lockfileCache.entries;
  }
  const entries = readLockfileEntries(raw.toString('utf8'), lockfilePath);
  lockfileCache = { path: lockfilePath, key, entries };
  return entries;
}

/**
 * レンダラ実装の指紋。実装を変更すると全記事のhashが変わり、CIが全件を再生成する。
 * 実装ファイルは毎回読み直す。devサーバーのような長寿命プロセスで編集を取りこぼさないためで、
 * 対象は4ファイル計100KB弱なので記事数だけ繰り返しても実測で100ms未満に収まる。
 */
export function computeRendererFingerprint(rootDir: string = process.cwd()): string {
  const hash = createHash('sha256');
  for (const relativePath of RENDERER_SOURCE_FILES) {
    hash
      .update(relativePath)
      .update('\0')
      .update(readRendererInput(join(rootDir, relativePath)));
  }

  const entries = loadLockfileEntries(join(rootDir, LOCKFILE));
  for (const name of RENDERER_DEPENDENCIES) {
    const entry = entries[name];
    hash.update(name).update('\0').update(entry.version).update('\0').update(entry.snapshot);
  }

  return hash.digest('hex').slice(0, HASH_LENGTH);
}

/**
 * 記事markdownの全文とレンダラ実装の指紋からhashを算出する。
 *
 * ビルド時 (og:image のURL組み立て) とCI (画像生成) が同じ値を導出しなければ、
 * og:image が存在しないR2オブジェクトを指して全記事のOG画像が404になる。
 * 入力の取り違えを防ぐため、呼び出し側は原則 computeOgImageHashFromFile を使い、
 * 「同じファイルの全文」以外を渡せないようにする。
 *
 * 全文を入力にする副作用として、last_edited_time だけが変わる編集 (タグ変更等) でも
 * hashが変わり再生成が走る。描画結果は同じだが害はなく、古いオブジェクトはR2に残る。
 */
export function computeOgImageHash(markdown: string, rendererFingerprint: string): string {
  return createHash('sha256').update(`${rendererFingerprint}\0${markdown}`).digest('hex').slice(0, HASH_LENGTH);
}

/** 記事markdownファイルを読んでhashを算出する。ビルド時とCIの双方がこの関数を使う */
export function computeOgImageHashFromFile(filePath: string, rootDir: string = process.cwd()): string {
  return computeOgImageHash(readFileSync(filePath, 'utf8'), computeRendererFingerprint(rootDir));
}

/**
 * R2上のオブジェクト名。hashを含むためイミュータブルに扱える。
 * ja と en は同じ slug を共有する (i18n pair として正常) ため、localeを名前に含めて
 * R2上でどちらの言語版かを判別できるようにする。
 */
export function buildOgImageFileName(slug: string, locale: string, hash: string): string {
  return `${slug}.${locale}.${hash}.png`;
}

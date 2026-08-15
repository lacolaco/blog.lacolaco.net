import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
 * 描画結果を左右する依存。バージョンが変わるとグリフ配置や分節が変わりうるため、
 * package.json 上のバージョン指定を指紋の入力に含める。
 */
export const RENDERER_DEPENDENCIES = ['satori', '@resvg/resvg-js', 'budoux', 'date-fns'] as const;

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

/** ファイル内容を読まずに変更を検知するための軽量キー */
function statKey(path: string): string {
  try {
    const stat = statSync(path);
    return `${stat.mtimeMs}:${stat.size}`;
  } catch (cause) {
    throw rendererInputError(path, cause);
  }
}

const fingerprintCache = new Map<string, string>();

/**
 * レンダラ実装の指紋。実装を変更すると全記事のhashが変わり、CIが全件を再生成する。
 * devサーバーのように長寿命なプロセスでも実装の編集を拾えるよう、mtimeとサイズをキャッシュキーに含める。
 */
export function computeRendererFingerprint(rootDir: string = process.cwd()): string {
  const paths = RENDERER_SOURCE_FILES.map((relativePath) => join(rootDir, relativePath));
  const packageJsonPath = join(rootDir, 'package.json');
  const cacheKey = [rootDir, ...paths.map(statKey), statKey(packageJsonPath)].join('|');

  const cached = fingerprintCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const hash = createHash('sha256');
  for (const relativePath of RENDERER_SOURCE_FILES) {
    hash
      .update(relativePath)
      .update('\0')
      .update(readRendererInput(join(rootDir, relativePath)));
  }

  const packageJson = JSON.parse(readRendererInput(packageJsonPath).toString('utf8')) as {
    dependencies?: Record<string, string>;
  };
  for (const name of RENDERER_DEPENDENCIES) {
    hash
      .update(name)
      .update('\0')
      .update(packageJson.dependencies?.[name] ?? '');
  }

  const fingerprint = hash.digest('hex').slice(0, HASH_LENGTH);
  fingerprintCache.set(cacheKey, fingerprint);
  return fingerprint;
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

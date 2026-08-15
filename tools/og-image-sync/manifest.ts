import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import type { Locale, OgImageTarget } from './discover.ts';

/** slug + locale から R2 上のオブジェクト名を引くマップ */
export type OgManifest = Record<string, string>;

export interface GenerationPlan {
  /** 生成が必要な記事 */
  toGenerate: OgImageTarget[];
  /** 生成不要でそのまま引き継ぐエントリ */
  carryOver: OgManifest;
}

/** ja と en は同じ slug を共有するため、locale と組み合わせて一意にする */
export function manifestKey(slug: string, locale: Locale): string {
  return `${slug}.${locale}`;
}

/** 前回のマニフェストがない場合だけ空として扱う。読めない場合は全件再生成になるため失敗させる */
export function readManifest(path: string): OgManifest {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw cause;
  }
  return JSON.parse(raw) as OgManifest;
}

/**
 * キーをソートして書き出す。差分を読みやすく保つため。
 * localeCompare は ICU の照合順序と環境の既定ロケールに依存し、実行環境によって
 * 並び順が変わって無意味な差分を生むため、コードポイント順で比較する。
 *
 * 生成1件ごとに呼ばれるため、書き込み途中でプロセスが終了する機会が多い。
 * 直接上書きすると壊れたJSONが残り、次回の readManifest が失敗してパイプラインが止まる。
 * 一時ファイルへ書いてから rename することで、内容が中途半端な状態を観測させない。
 */
export function writeManifest(path: string, manifest: OgManifest): void {
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  const temporaryPath = `${path}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, path);
}

/**
 * 生成を始める前に書き出すマニフェストを組み立てる。
 *
 * 再生成待ちのキーには旧ファイル名を残す。R2上の旧オブジェクトは削除しないため
 * 旧ファイル名は依然として有効であり、中断しても開始前の状態を下回らない。
 * 新規記事は指す先がまだ存在しないので、生成が終わるまで含めない。
 */
export function seedManifest(carryOver: OgManifest, toGenerate: OgImageTarget[], previous: OgManifest): OgManifest {
  const seeded: OgManifest = { ...carryOver };
  for (const target of toGenerate) {
    const key = manifestKey(target.slug, target.locale);
    const stale = previous[key];
    if (stale) {
      seeded[key] = stale;
    }
  }
  return seeded;
}

/** 記事の削除は正常な操作なので、この割合を下回る減少だけを異常とみなす */
const TRUNCATION_RATIO = 0.5;

/**
 * 記事の激減はcwdの誤りやチェックアウトの不備を疑うべき状況である。
 * そのまま進むとマニフェストを切り詰め、R2上の画像への参照を失う。
 *
 * 0件だけを見ると、notion/posts が欠けて posts だけ残るような部分的な欠落を見逃す。
 */
export function assertNotTruncating(targetCount: number, previous: OgManifest): void {
  const previousCount = Object.keys(previous).length;
  if (previousCount === 0) {
    return;
  }
  if (targetCount < previousCount * TRUNCATION_RATIO) {
    throw new Error(
      `公開記事が ${targetCount} 件しか見つからないのにマニフェストには ${previousCount} 件ある。` +
        `content を読めているか確認する`,
    );
  }
}

/**
 * 生成対象を決める。
 * ファイル名は hash を含むため、記事の変更もレンダラ実装の変更もファイル名の差として現れる。
 * 記事が削除されたエントリは引き継がない。参照されなくなるだけで、R2上の画像は残す。
 */
export function planGeneration(targets: OgImageTarget[], previous: OgManifest): GenerationPlan {
  const carryOver: OgManifest = {};
  const toGenerate: OgImageTarget[] = [];
  const seen = new Map<string, OgImageTarget>();

  for (const target of targets) {
    const key = manifestKey(target.slug, target.locale);
    const existing = seen.get(key);
    if (existing) {
      // ビルド側の assertUniqueSlugs と同じく fail-loud にする。
      // 黙って上書きすると、生成した画像の片方が参照されないまま残る
      throw new Error(
        `slug "${target.slug}" (locale: ${target.locale}) が重複している:\n  ${existing.filePath}\n  ${target.filePath}`,
      );
    }
    seen.set(key, target);

    if (previous[key] === target.fileName) {
      carryOver[key] = target.fileName;
    } else {
      toGenerate.push(target);
    }
  }

  return { toGenerate, carryOver };
}

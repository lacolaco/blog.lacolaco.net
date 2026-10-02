import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { OG_OUTPUT_DIR_NAME } from './discover.ts';

/**
 * R2へ送るためだけの置き場。git 管理下には置かない。
 *
 * アップロード側 (blog-contents の r2-sync) に渡す sourceDir はここである。
 * 内側の OUTPUT_DIR を渡すと、キーが `og/` を失ってバケット直下になり、
 * 記事画像と衝突しないまま配信URLだけが 404 する。
 */
export const STAGING_DIR = '.tmp/og-staging';

/**
 * 実際に画像を書き出す場所。
 *
 * `og/` を内側に持つのは、r2-sync が sourceDir からの相対パスをそのままキーにするため。
 * STAGING_DIR を sourceDir に渡すと `og/<file>` というキーになり、
 * 記事画像 (`<slug>/<file>`) や動画 (`videos/...`) と衝突しない。
 */
export const OUTPUT_DIR = join(STAGING_DIR, OG_OUTPUT_DIR_NAME);

/**
 * 出力先を作り直す。
 *
 * 前回の出力は消す。STAGING_DIR はそのままアップロードされる集合なので、残すと
 * 今回描いていない画像まで送られ、集合が実行ごとに変わる。
 * アップロード1回につきこのツールの実行が1回であることを前提にする。
 *
 * 戻り値はアップロード側に渡す sourceDir。内側の出力先を渡すとキーが `og/` を失い、
 * 記事画像と衝突しないまま配信URLだけが 404 する。
 *
 * 描くものがある回だけ呼ぶこと。対象の指定がない実行から呼ぶと、直前の実行で描いた
 * 画像が消え、続くアップロードが何も送らずに成功する。
 */
export async function prepareStaging(rootDir: string): Promise<{ stagingDir: string; outputDir: string }> {
  const stagingDir = join(rootDir, STAGING_DIR);
  const outputDir = join(rootDir, OUTPUT_DIR);
  await rm(stagingDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  return { stagingDir, outputDir };
}

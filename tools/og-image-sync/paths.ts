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

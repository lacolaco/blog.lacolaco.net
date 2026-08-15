import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { listArticleFiles, toTargetOrSkip } from './discover.ts';
import { SITE_DOMAIN_NAME } from '../../src/libs/og-image/constants.ts';
import {
  assertNotTruncating,
  manifestKey,
  planGeneration,
  readManifest,
  seedManifest,
  writeManifest,
} from './manifest.ts';
import { createBatchedFontLoader } from './fonts.ts';
import { renderOgImage } from './render.ts';

const CONTENT_DIR = 'content';
const OUTPUT_DIR = 'public/images/og';
const MANIFEST_PATH = 'og-manifest.json';

/**
 * OG画像を事前生成し、マニフェストを更新する。
 *
 * R2へのアップロードは行わない。blog-contents の sync ワークフローが public/images を
 * まとめてアップロードするため、書き込み経路をそちらに一本化している。
 */
async function main(): Promise<void> {
  const rootDir = process.cwd();
  const outputDir = join(rootDir, OUTPUT_DIR);
  const manifestPath = join(rootDir, MANIFEST_PATH);

  const files = await listArticleFiles(join(rootDir, CONTENT_DIR));
  const previous = readManifest(manifestPath);
  const targets = files.map((filePath) => toTargetOrSkip(filePath, rootDir)).filter((t) => t !== null);

  assertNotTruncating(targets.length, previous);

  const { toGenerate, carryOver } = planGeneration(targets, previous);

  console.log(`[og-image-sync] ${files.length} files, ${targets.length} published, ${toGenerate.length} to generate`);

  // 生成のたびに書き出す。描画は記事ごとにGoogle Fontsへの取得を伴い、
  // 一度の失敗で全件の進捗を捨てると再実行のコストが大きい
  const manifest = seedManifest(carryOver, toGenerate, previous);
  writeManifest(manifestPath, manifest);

  // 記事ごとにGoogle Fontsへ問い合わせると記事数×3回になるため、全記事分を一度に取得する
  const fontLoader =
    toGenerate.length > 0
      ? await createBatchedFontLoader(
          toGenerate.map((t) => t.title),
          SITE_DOMAIN_NAME,
        )
      : undefined;

  await mkdir(outputDir, { recursive: true });
  for (const [index, target] of toGenerate.entries()) {
    const png = await renderOgImage(target, rootDir, fontLoader);
    await writeFile(join(outputDir, target.fileName), png);
    manifest[manifestKey(target.slug, target.locale)] = target.fileName;
    writeManifest(manifestPath, manifest);
    console.log(`[og-image-sync] (${index + 1}/${toGenerate.length}) ${target.fileName}`);
  }

  console.log(`[og-image-sync] wrote ${MANIFEST_PATH} with ${Object.keys(manifest).length} entries`);
}

await main();

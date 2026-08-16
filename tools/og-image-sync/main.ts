import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CONTENT_DIR,
  assertUniqueTargets,
  listArticleFiles,
  resolveRequestedFiles,
  toTargetOrSkip,
} from './discover.ts';
import { SITE_DOMAIN_NAME } from '../../src/libs/og-image/constants.ts';
import { parseArgs } from './args.ts';
import { createBatchedFontLoader } from './fonts.ts';
import { renderOgImage } from './render.ts';

const OUTPUT_DIR = 'public/images/og';

/**
 * OG画像を生成する。
 *
 * 対象は引数で受け取る。呼び出し側 (blog-contents の sync) が「今回書き出した記事」を
 * 知っているため、こちらで差分を判定しない。
 *
 * 全記事の作り直し (レンダラ実装を変更したとき) は `--all` で明示する。
 * 引数なしを全件と解釈すると、呼び出し側が空の差分をそのまま渡したときに
 * 気付かないまま全件再生成が走る。それはこの設計が避けようとしている無駄そのものである。
 *
 * R2へのアップロードは行わない。blog-contents の sync ワークフローが public/images を
 * まとめてアップロードするため、書き込み経路をそちらに一本化している。
 */
async function main(): Promise<void> {
  const rootDir = process.cwd();
  const outputDir = join(rootDir, OUTPUT_DIR);
  const { renderAll, requested } = parseArgs(process.argv.slice(2));

  // 記事の削除だけ、tags.json の更新だけ、という sync は正常にありうる
  if (!renderAll && requested.length === 0) {
    console.log('[og-image-sync] 生成対象の指定がない');
    return;
  }

  const { files, dropped } = renderAll
    ? { files: await listArticleFiles(join(rootDir, CONTENT_DIR)), dropped: [] }
    : resolveRequestedFiles(requested, rootDir);

  // 対象外にした内訳は必ず出す。記事の削除や tags.json の混入は正常だが、
  // パスの基準を取り違えた場合も同じ形で現れるため、件数だけでは区別できない
  if (dropped.length > 0) {
    console.warn(`[og-image-sync] ${dropped.length} 件を対象外にした (対象 ${files.length} 件): ${dropped.join(' ')}`);
  }

  // --all で0件は、実行位置かチェックアウトの誤りしかありえない
  if (renderAll && files.length === 0) {
    throw new Error(`${CONTENT_DIR} 配下に記事が見つからない。実行位置とチェックアウトを確認する`);
  }

  const targets = files.map((filePath) => toTargetOrSkip(filePath, rootDir)).filter((target) => target !== null);
  assertUniqueTargets(targets);

  console.log(`[og-image-sync] ${files.length} files, ${targets.length} to render`);
  if (targets.length === 0) {
    // 対象が全て未公開・下書きだった場合。ファイルは見えているので異常ではない
    return;
  }

  // 記事ごとにGoogle Fontsへ問い合わせると記事数×3回になるため、一度に取得する
  const fontLoader = await createBatchedFontLoader(
    targets.map((target) => target.title),
    SITE_DOMAIN_NAME,
  );

  await mkdir(outputDir, { recursive: true });
  for (const [index, target] of targets.entries()) {
    const png = await renderOgImage(target, rootDir, fontLoader);
    await writeFile(join(outputDir, target.fileName), png);
    console.log(`[og-image-sync] (${index + 1}/${targets.length}) ${target.fileName}`);
  }
}

await main();

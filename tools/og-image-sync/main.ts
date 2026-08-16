import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CONTENT_DIR,
  OG_OUTPUT_DIR_NAME,
  assertRenderable,
  assertUniqueTargets,
  assertRequestResolved,
  resolveAllArticles,
  resolveRequestedFiles,
  toTargetOrSkip,
} from './discover.ts';
import { SITE_DOMAIN_NAME } from '../../src/libs/og-image/constants.ts';
import { parseArgs } from './args.ts';
import { createBatchedFontLoader } from './fonts.ts';
import { renderOgImage } from './render.ts';

/**
 * R2へ送るためだけの置き場。git 管理下には置かない。
 *
 * `og/` を内側に持つのは、r2-sync が sourceDir からの相対パスをそのままキーにするため。
 * このディレクトリを sourceDir に渡すと `og/<file>` というキーになり、
 * 記事画像 (`<slug>/<file>`) や動画 (`videos/...`) と衝突しない。
 */
const STAGING_DIR = '.tmp/og-staging';
const OUTPUT_DIR = join(STAGING_DIR, OG_OUTPUT_DIR_NAME);

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
 * R2へのアップロードは行わない。書き込み経路は blog-contents が持っており、
 * こちらは OUTPUT_DIR に置くところまでを担う。
 */
async function main(): Promise<void> {
  const rootDir = process.cwd();
  const outputDir = join(rootDir, OUTPUT_DIR);
  const { renderAll, requested } = parseArgs(process.argv.slice(2));

  // 手元で引数なしに実行した場合。呼び出し側 (blog-contents の sync) は対象0件のとき
  // ステップごと飛ばすため、CI からは来ない。
  // 掘ってから返す。対象があって0件だった回と扱いを揃えないと、ディレクトリの有無で
  // 「動いていない」を判別できなくなる
  if (!renderAll && requested.length === 0) {
    await mkdir(outputDir, { recursive: true });
    console.log('[og-image-sync] 生成対象の指定がない');
    return;
  }

  const resolved = renderAll ? await resolveAllArticles(rootDir) : resolveRequestedFiles(requested, rootDir);
  const { files, dropped, duplicated } = resolved;

  // 対象外にした内訳は必ず出す。記事の削除や tags.json の混入は正常だが、
  // パスの基準を取り違えた場合も同じ形で現れるため、件数だけでは区別できない
  if (dropped.length > 0) {
    console.warn(`[og-image-sync] ${dropped.length} 件を対象外にした (対象 ${files.length} 件): ${dropped.join(' ')}`);
  }
  // 重複は基準の取り違えではない。同じ警告に混ぜると、そちらの手がかりが薄まる
  if (duplicated.length > 0) {
    console.warn(`[og-image-sync] ${duplicated.length} 件は同じファイルの重複だった: ${duplicated.join(' ')}`);
  }

  if (!renderAll) {
    assertRequestResolved(requested, resolved);
  }

  // --all で0件は、実行位置かチェックアウトの誤りしかありえない
  if (renderAll && files.length === 0) {
    throw new Error(`${CONTENT_DIR} 配下に記事が見つからない。実行位置とチェックアウトを確認する`);
  }

  const targets = files.map((filePath) => toTargetOrSkip(filePath, rootDir)).filter((target) => target !== null);
  assertUniqueTargets(targets);

  console.log(`[og-image-sync] ${files.length} files, ${targets.length} to render`);

  // 描く前に止める。ここで落ちればアップロードのステップも走らないため、
  // 途中まで描いても送られない
  assertRenderable(resolved, targets, rootDir);

  // 掃除するのは全件を作り直すときだけ。差分実行は積み増しにする。
  //
  // 消すのは r2-sync に渡す sourceDir そのもの。内側だけ消すと直下の残骸が残る。
  // 差分実行でも消すと、呼び出し側がパスを分割して2回呼んだときに後の実行が前の出力を
  // 消し、欠けたままアップロードされる。分割しない前提はコメントでしか担保できない。
  // 一方、残骸が混ざって再送されても、R2 は古い画像を消さないので既にある物を
  // 上書きするだけで実害はない。手元で --all の直後に差分実行すると368件を再送するが、
  // CI は毎回チェックアウトし直すので起こらない
  if (renderAll) {
    await rm(join(rootDir, STAGING_DIR), { recursive: true, force: true });
  }

  // 出力先は対象0件でも掘る。描くものがなかったことを呼び出し側に示す
  await mkdir(outputDir, { recursive: true });

  // 手書きツリーの下書きだけを指定した場合など、対象0件は正常にありうる。
  // 空のままフォント取得へ進むと、サブセットされないフォントを無駄に取りに行く
  if (targets.length === 0) {
    return;
  }

  // 記事ごとにGoogle Fontsへ問い合わせると記事数×3回になるため、一度に取得する
  const fontLoader = await createBatchedFontLoader(
    targets.map((target) => target.title),
    SITE_DOMAIN_NAME,
  );

  for (const [index, target] of targets.entries()) {
    const png = await renderOgImage(target, rootDir, fontLoader);
    await writeFile(join(outputDir, target.fileName), png);
    console.log(`[og-image-sync] (${index + 1}/${targets.length}) ${target.fileName}`);
  }
}

await main();

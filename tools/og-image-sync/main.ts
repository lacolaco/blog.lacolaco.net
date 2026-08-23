import { join } from 'node:path';
import {
  CONTENT_DIR,
  assertRequestResolved,
  assertUniqueTargets,
  listArticleFiles,
  resolveRequestedFiles,
  isSyncOutput,
  isTarget,
  type ResolvedRequest,
  type SkipReason,
  toTargetOrSkip,
} from './discover.ts';
import { SITE_DOMAIN_NAME } from '../../src/libs/og-image/constants.ts';
import { prepareStaging } from './paths.ts';
import { parseArgs } from './args.ts';
import {
  REPORT_FILE,
  buildEmptyRenderReport,
  buildRenderReport,
  buildTreeReport,
  clearRenderReport,
  writeRenderReport,
} from './report.ts';
import { createBatchedFontLoader } from './fonts.ts';
import { renderOgImage } from './render.ts';
import { writeRenderedImages } from './write.ts';

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
  // 何よりも先に消す。引数の解釈で落ちる回もあり、前回の数が残ると
  // 呼び出し側が今回の枚数と突き合わせて取り違える
  clearRenderReport(rootDir);
  console.log(`[og-image-sync] render report: ${join(rootDir, REPORT_FILE)}`);
  const { renderAll, requested: requestedPaths } = parseArgs(process.argv.slice(2));

  // 記事の削除だけ、tags.json の更新だけ、という sync は正常にありうる
  if (!renderAll && requestedPaths.length === 0) {
    console.log('[og-image-sync] 生成対象の指定がない');
    // 出力先は作り直していない。前の回の画像が残りうるので突き合わせには使えない
    writeRenderReport(rootDir, buildEmptyRenderReport());
    return;
  }

  // 呼ぶのは対象の指定がある回だけ。上の早期 return より前に動かすと、手元で描いた直後に
  // 引数なしで叩くだけで消え、続くアップロードが何も送らずに成功する。
  // パスの基準を取り違えた実行では消したあとに判明するが、CI は毎回まっさらなので
  // 影響は手元の反復だけ
  const { stagingDir, outputDir } = await prepareStaging(rootDir);

  // アップロード側 (r2-sync) に渡す sourceDir を出す。内側の OUTPUT_DIR を渡すとキーが
  // og/ を失い、記事画像と衝突しないまま配信URLだけが 404 する。
  // 絶対パスで出すのは、2つのチェックアウトが混在する CI ログで照合するため。
  //
  // 掃除より後に出す。対象の指定がない回で出すと、前回の出力が残ったままの
  // ディレクトリを「今回の送信元」として案内することになる
  console.log(`[og-image-sync] upload source: ${stagingDir}`);

  const resolved: ResolvedRequest = renderAll
    ? {
        files: await listArticleFiles(join(rootDir, CONTENT_DIR)),
        dropped: [],
        outOfScope: [],
        inSyncOutputOf: new Map(),
      }
    : resolveRequestedFiles(requestedPaths, rootDir);
  const { files, dropped, inSyncOutputOf } = resolved;

  // 対象外にした内訳は必ず出す。記事の削除や tags.json の混入は正常だが、
  // パスの基準を取り違えた場合も同じ形で現れるため、件数だけでは区別できない
  if (dropped.length > 0) {
    console.warn(`[og-image-sync] ${dropped.length} 件を対象外にした (対象 ${files.length} 件): ${dropped.join(' ')}`);
  }

  if (!renderAll) {
    assertRequestResolved(requestedPaths, resolved);
  }

  // 外した理由ごとに、ツリー別に数える。未公開 (正常) と記述の不備 (異常) を
  // 同じ数にまとめると静かな欠落を見分けられず、ツリーをまとめると
  // 手書きが混ざった回に sync の出力の異常まで見逃す
  // 所属は1度だけ決める。判定は実体の解決を伴うので、引き直すと入力の数だけ余計に
  // ファイルシステムを叩く。個別指定は resolveRequestedFiles が済ませているため
  // 必ず引ける。引けないのは --all の列挙だけで、そちらはここで判定する
  const belongsToSync = (path: string) => inSyncOutputOf.get(path) ?? isSyncOutput(path, rootDir);
  const results = files.map((filePath) => ({
    inSync: belongsToSync(filePath),
    result: toTargetOrSkip(filePath, rootDir),
  }));
  const droppedByTree = dropped.map((path) => ({ inSync: belongsToSync(path), path }));
  const targets = results.map(({ result }) => result).filter(isTarget);
  const treeReport = (inSync: boolean) => {
    const mine = results.filter((entry) => entry.inSync === inSync);
    const countOf = (reason: SkipReason) => mine.filter(({ result }) => result === reason).length;
    return buildTreeReport(
      mine.length,
      droppedByTree.filter((entry) => entry.inSync === inSync).map(({ path }) => path),
      {
        unpublished: countOf('unpublished'),
        notAnArticle: countOf('not-an-article'),
        invalid: countOf('invalid'),
      },
    );
  };
  const sync = treeReport(true);
  const authored = treeReport(false);
  assertUniqueTargets(targets);

  console.log(`[og-image-sync] ${files.length} files, ${targets.length} to render`);
  if (targets.length === 0) {
    // 対象が全て未公開・下書きだった場合。ファイルは見えているので異常ではない
    writeRenderReport(rootDir, buildRenderReport({ sync, authored, rendered: 0, outputDir }));
    return;
  }

  // 記事ごとにGoogle Fontsへ問い合わせると記事数×3回になるため、一度に取得する
  const fontLoader = await createBatchedFontLoader(
    targets.map((target) => target.title),
    SITE_DOMAIN_NAME,
  );

  const rendered = await writeRenderedImages(
    targets,
    outputDir,
    (target) => renderOgImage(target, rootDir, fontLoader),
    (target, index) => console.log(`[og-image-sync] (${index + 1}/${targets.length}) ${target.fileName}`),
  );

  // 数と書き出しは1か所に閉じてある。ここで数え直すと、その対応が崩れても気付けない
  writeRenderReport(rootDir, buildRenderReport({ sync, authored, rendered, outputDir }));
}

await main();

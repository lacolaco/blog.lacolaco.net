import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * 報告の置き場所。
 *
 * STAGING_DIR の外に置く。中に置くと r2-sync がそのまま R2 へ送ってしまう。
 * 中身の意味は RenderReport が持つ
 */
export const REPORT_FILE = '.tmp/og-image-sync-report.json';

/** ツリーごとの内訳。sync の出力と手書きツリーでは、描かれない件の意味が違う */
export interface TreeReport {
  /** 記事として受け取り、描くかどうかを判断した件数 */
  targeted: number;
  /** 渡されたのに対象外にした記事の件数。記事でない入力 (tags.json など) は数えない */
  droppedArticles: number;
  /** 描かなかった理由ごとの件数 */
  skipped: { unpublished: number; notAnArticle: number; invalid: number };
}

export interface RenderReport {
  /**
   * sync が書き出した記事の内訳。
   *
   * ここは全件が描かれるはずである。収集は公開済みの記事しか渡さず、不備はその場で
   * 失敗するため、対象外や描かれない件が出るのは判定が壊れた回だけである
   */
  sync: TreeReport;
  /**
   * 手書きツリーの記事の内訳。
   *
   * 不備が混ざる前提なので、描かれない件があっても正常でありうる。
   * ツリーごとに分けるのは、1回の実行に両方が混ざったときに、
   * sync の出力の異常まで「手書きが混ざっているから」と見逃さないため
   */
  authored: TreeReport;
  /** 実際に書き出せた枚数 */
  rendered: number;
  /** 出力先を作り直したか */
  staged: boolean;
  /**
   * `rendered` と数を突き合わせる場所。作り直していない回は無い。
   *
   * 呼び出し側に組み立てさせない。ここを数えないと (アップロードに渡す stagingDir を
   * 数えるなど) `og/` 1件になって必ず食い違う。送る場所は stagingDir が持つので、
   * ここから導かないこと。
   * `staged` を見落としても別の場所を数えずに済むよう、無い回は null にする
   */
  outputDir: string | null;
  /**
   * アップロードに渡す場所。作り直していない回は無い。
   *
   * `outputDir` の親から求めさせない。出力の階層を1段深くしただけで、
   * 呼び出し側が `og/` 自体を送ることになり、R2 のキーから `og/` が落ちて
   * 配信URLだけが404する
   */
  stagingDir: string | null;
}

/**
 * 描いた回の報告を組み立てる。
 *
 * 呼び出し側で組み立てると、受け取った件数と描いた枚数を取り違えても気付けない。
 * 描画そのものはフォントの取得と指紋の算出を要して実行で確かめられないため、
 * 値の対応だけをここに閉じてテストで固定する
 */
export function buildRenderReport({
  sync,
  authored,
  rendered,
  outputDir,
  stagingDir,
}: {
  sync: TreeReport;
  authored: TreeReport;
  rendered: number;
  outputDir: string;
  stagingDir: string;
}): RenderReport {
  return { sync, authored, rendered, staged: true, outputDir, stagingDir };
}

/** ツリー1つ分の内訳を作る。記事でない入力は数えない (混入は正常であり、異常が埋もれる) */
export function buildTreeReport(targeted: number, dropped: string[], skipped: TreeReport['skipped']): TreeReport {
  return {
    targeted,
    droppedArticles: dropped.filter((path) => path.endsWith('.md')).length,
    skipped,
  };
}

/**
 * 描くものが無かった回の報告。
 *
 * 出力先を作り直していないので、数える場所は持たない。リテラルで組み立てると、
 * 項目を足したときにこの経路だけ漏れる
 */
export function buildEmptyRenderReport(): RenderReport {
  const empty = () => buildTreeReport(0, [], { unpublished: 0, notAnArticle: 0, invalid: 0 });
  return { sync: empty(), authored: empty(), rendered: 0, staged: false, outputDir: null, stagingDir: null };
}

/**
 * 描いた枚数を残す。呼び出し側はこれと実際のファイル数を突き合わせる。
 *
 * 同期で書く。報告は「ここまでは正しく終えた」という印であり、待たずに次へ進めると
 * 直後に落ちた回に書き切れず、正常に終えたのに報告だけが無い状態になる。
 *
 * `staged` は出力先を作り直したかどうか。作り直していない回は前の回の画像が残るので、
 * 枚数は一致しない。呼び出し側がこれだけを見て突き合わせの可否を決められるようにする。
 *
 * `targeted` を併せて載せる。受け取ったのに1枚も描かれなかった回は、
 * 枚数だけを見ると0対0で揃ってしまい素通りする。呼び出し側はこれを失敗として扱う
 */
export function writeRenderReport(rootDir: string, report: RenderReport): void {
  const path = join(rootDir, REPORT_FILE);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(report)}\n`, 'utf8');
}

/**
 * 前回の報告を消す。
 *
 * 残したまま落ちると、呼び出し側が前回の数と今回のファイル数を突き合わせ、
 * 1枚も描かなかった回を見逃す。
 *
 * 消したあとに書き戻すのは正常に終えた回だけである。したがって報告が無いことは
 * 「途中で落ちた」を意味する。呼び出し側は不在を成功として扱ってはならない
 * (部分的に描かれた画像が残っており、そのまま送ると欠けたまま公開される)。
 *
 * 逆は成り立たない。これを呼ぶより前に落ちた回 (依存の読み込みの失敗など) では
 * 前の回の報告が残る。呼び出し側は終了コードを先に見ること
 */
export function clearRenderReport(rootDir: string): void {
  rmSync(join(rootDir, REPORT_FILE), { force: true });
}

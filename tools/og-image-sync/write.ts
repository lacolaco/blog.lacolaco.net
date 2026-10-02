import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { OgImageTarget } from './discover.ts';

/**
 * 描いた画像を出力先へ書き出し、書けた数を返す。
 *
 * 数はここで数える。書き出しと計上を離すと、片方だけ直したときに
 * 報告と実際の枚数がずれ、送る前の突き合わせが意味を失う。
 *
 * 描画そのものは差し替えられる。実際に描くとフォントの取得が要り、
 * 数と書き出しの対応だけを確かめたい場面で網の外に出てしまう。
 *
 * render.ts に置かない。あちらは指紋の対象で、触ると全記事の再生成を誘発する。
 * ここは画素を変えない (バッファをそのまま書くだけ) ので、指紋に入れる理由がない
 */
export async function writeRenderedImages(
  targets: OgImageTarget[],
  outputDir: string,
  render: (target: OgImageTarget, index: number) => Promise<Buffer>,
  onWritten?: (target: OgImageTarget, index: number) => void,
): Promise<number> {
  let written = 0;
  for (const [index, target] of targets.entries()) {
    const png = await render(target, index);
    await writeFile(join(outputDir, target.fileName), png);
    written += 1;
    // 書けてから知らせる。描いた時点で出すと、書き込みが落ちた回に
    // 存在しないファイルの行がログに残り、実態を上回る
    onWritten?.(target, index);
  }
  return written;
}

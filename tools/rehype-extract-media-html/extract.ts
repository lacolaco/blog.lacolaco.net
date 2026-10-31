import type { RootContent } from 'hast';
import { fromHtml } from 'hast-util-from-html';

// notion-sync が markdown に書き出す `<video>`、および記事本文が使う生 HTML の
// `<img src="/images/...">` (`<figure><img></figure>` などの figure キャプション用) は
// mdast→hast 変換の allowDangerousHtml 仕様により hast の raw ノードとして残る。
// 後段の rehype-image-cdn は element しか visit しないため CDN 書き換えが効かず、
// production で 404 になる。rehype-raw を使うと markdown 内の全 raw HTML が element 化
// されて意図しない副作用 (属性正規化など) が広範に出るため、対象タグを含む raw ノード
// のみを最小スコープで element に展開する。
//
// 誤検知回避: 単純な `<video` / `<img` 部分一致だと説明テキスト (`<p>The <img> tag</p>`)
// や HTML コメント (`<!-- <img> sample -->`) も誤検知し、fromHtml が周囲の <p> を
// 取り込んでレンダリングが壊れる。タグ直後に空白 + src 属性 + 特定パス (`/videos/`
// または `/images/`) を要求して、コンテンツ配信対象の生 HTML だけにマッチさせる。
// `i` フラグで <VIDEO>/<Video>/<IMG>/<Img> も拾う
const VIDEO_TAG_PATTERN = /<video\s[^>]*\bsrc=["']\/videos\//i;
const IMG_TAG_PATTERN = /<img\s[^>]*\bsrc=["']\/images\//i;

/**
 * 対象の生 HTML を element の列に展開する。対象でなければ undefined。
 * unified (rehype) と Sätteri のどちらのプラグインからも同じ判定と展開を使う
 */
export function extractMediaHtml(value: string): RootContent[] | undefined {
  // HTML コメントブロックは展開対象外。fromHtml に通すと raw → comment ノードに
  // 変換されるため、`raw のまま保持する` 意図とずれる。文字列出力では同じ
  // ため挙動上の差は出ないが、後段プラグインの ノード type 依存処理を壊さないよう
  // 早期 return する
  if (value.trimStart().startsWith('<!--')) return;
  if (!VIDEO_TAG_PATTERN.test(value) && !IMG_TAG_PATTERN.test(value)) return;
  return fromHtml(value, { fragment: true }).children;
}

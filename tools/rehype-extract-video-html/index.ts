import type { Root } from 'hast';
import { fromHtml } from 'hast-util-from-html';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';

// notion-sync が markdown に書き出す `<video>` は生 HTML として hast の raw ノードに残る
// (mdast→hast 変換の allowDangerousHtml 仕様)。後段の rehype-image-cdn は element しか
// 見ないため CDN 書き換えが効かない。rehype-raw を使うと markdown 内の全 raw HTML が
// element 化されて意図しない副作用 (属性正規化など) が広範に出るため、`<video>` を
// 含む raw ノードのみを最小スコープで element に展開する。
//
// notion-sync の出力 (`<video src="/videos/{slug}/{file}" ...>`) を identify する。
// 単純な `<video` 部分一致だと説明テキスト (`<p>The <video> tag</p>`) や HTML コメント
// (`<!-- <video> sample -->`) も誤検知し、fromHtml が周囲の <p> を取り込んで
// レンダリングが壊れる。`<video` 直後に空白 + src 属性 + `/videos/` パスを要求して
// notion-sync 由来の <video> だけにマッチさせる。`i` フラグで <VIDEO>/<Video> も拾う
const VIDEO_TAG_PATTERN = /<video\s[^>]*\bsrc=["']\/videos\//i;

const rehypeExtractVideoHtml: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'raw', (node, index, parent) => {
      if (typeof node.value !== 'string') return;
      // HTML コメントブロックは展開対象外。fromHtml に通すと raw → comment ノードに
      // 変換されるため、`raw のまま保持する` 意図とずれる。文字列出力では同じ
      // ため挙動上の差は出ないが、後段プラグインの ノード type 依存処理を壊さないよう
      // 早期 return する
      if (node.value.trimStart().startsWith('<!--')) return;
      if (!VIDEO_TAG_PATTERN.test(node.value)) return;
      if (!parent || typeof index !== 'number') return;
      const fragment = fromHtml(node.value, { fragment: true });
      const children = fragment.children;
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
  };
};

export default rehypeExtractVideoHtml;

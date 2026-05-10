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
// `i` フラグで `<VIDEO>` や `<Video>` も拾う (notion-sync 自体は小文字タグを吐くが、
// 将来別経路から大文字タグが流入してもサイレントに raw に落ちないよう保険)
const VIDEO_TAG_PATTERN = /<video[\s/>]/i;

const rehypeExtractVideoHtml: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'raw', (node, index, parent) => {
      if (typeof node.value !== 'string') return;
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

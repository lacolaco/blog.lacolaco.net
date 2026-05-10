import type { ElementContent } from 'hast';
import { fromHtml } from 'hast-util-from-html';

// mdast の html ノード (markdown 内の生 HTML) を hast に変換するハンドラ。
// notion-sync が出力する <video> は markdown 内に生 HTML として書かれるため、
// 何もしないと remark-rehype のデフォルトで hast の raw ノードに落ち、
// 後段の rehype プラグイン (例: rehype-image-cdn) からは visit('element') で見えない。
// ここで <video> を含む html だけを部分パースして element 化し、それ以外は従来通り
// raw のまま流すことで、副作用を <video> 周辺だけに最小化する。
//
// remark-rehype は raw 戻り値を allowDangerousHtml: true 前提で扱うため、
// `{ type: 'raw', value }` をそのまま返してよい。型上は raw が標準 hast の
// ElementContent 列挙にないため as cast で吸収する。
//
// `i` フラグで `<VIDEO>` や `<Video>` も拾う (notion-sync 自体は小文字タグを
// 吐くが、将来別経路から大文字タグが流入してもサイレントに raw に落ちないよう保険)
const VIDEO_TAG_PATTERN = /<video[\s/>]/i;

interface MdastHtmlNode {
  type: 'html';
  value: string;
}

export function handleHtml(_state: unknown, node: MdastHtmlNode): ElementContent | ElementContent[] {
  if (VIDEO_TAG_PATTERN.test(node.value)) {
    const fragment = fromHtml(node.value, { fragment: true });
    return fragment.children as ElementContent[];
  }
  return { type: 'raw', value: node.value } as unknown as ElementContent;
}

import type { Nodes } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { defineMdastPlugin } from 'satteri';
import { unified } from 'unified';

/**
 * リストの緩い/密の判定を、unified の処理系が使う remark-parse (micromark) の判定に合わせる。
 * 入れ子のリストの間に空行があるとき、Sätteri と micromark で spread を立てる位置が違い、li の中の p の有無が変わる。
 * 判定は同じ原文を remark-parse で解析した結果から、リストと項目の開始位置で引き当てる
 */
export const satteriListSpread = () => {
  const spreadByStart = new Map<string, boolean>();

  const collect = (node: Nodes) => {
    if ((node.type === 'list' || node.type === 'listItem') && node.position && node.spread != null) {
      spreadByStart.set(`${node.type}:${node.position.start.offset}`, node.spread);
    }
    if ('children' in node) node.children.forEach(collect);
  };

  return defineMdastPlugin({
    name: 'list-spread',
    options: { position: true },
    before(_root, ctx) {
      collect(unified().use(remarkParse).use(remarkGfm).parse(ctx.source));
    },
    list(node) {
      const spread = spreadByStart.get(`list:${node.position?.start.offset}`);
      if (spread !== undefined && spread !== node.spread) return { ...node, spread };
    },
    listItem(node) {
      const spread = spreadByStart.get(`listItem:${node.position?.start.offset}`);
      if (spread !== undefined && spread !== node.spread) return { ...node, spread };
    },
  });
};

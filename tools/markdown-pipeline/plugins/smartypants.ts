import type { Nodes as MdastNodes, Root, Text } from 'mdast';
import remarkSmartypants from 'remark-smartypants';
import { defineMdastPlugin } from 'satteri';
import { unified } from 'unified';

interface TextPair {
  original: Readonly<Text>;
  copy: Text;
}

// remark-smartypants が読むのは type / value / children だけなので、それだけを写した素の mdast を作る
function toPlain(node: Readonly<MdastNodes>, pairs: TextPair[]): MdastNodes {
  if ('children' in node) {
    // 子の型は親ごとに違うため、写した後は mdast の共用体として扱う
    const children = (node.children as MdastNodes[]).map((child) => toPlain(child, pairs));
    return { type: node.type, children } as MdastNodes;
  }
  const copy = { type: node.type, value: 'value' in node ? node.value : '' } as MdastNodes;
  if (node.type === 'text') pairs.push({ original: node, copy: copy as Text });
  return copy;
}

const keyOf = (node: Readonly<Text>) => `${node.position?.start.offset}:${node.position?.end.offset}`;

/**
 * Astro の unified の処理系が使う remark-smartypants を、Sätteri の mdast で動かす。
 * Sätteri 自前の smartPunctuation は引用符の組み方が違うため、features では切っておく。
 * 文書全体の text をつなげて変換する手順が remark-smartypants の要なので、同じプラグインをそのまま使う
 */
export const satteriSmartypants = () => {
  // 文書ごとの変換結果。text の開始と終了の位置で引き当てる。ファクトリとして渡すので文書ごとに作り直される
  const converted = new Map<string, string>();

  return defineMdastPlugin({
    name: 'smartypants',
    options: { position: true },
    before(root) {
      const pairs: TextPair[] = [];
      const plain = toPlain(root, pairs) as Root;
      unified().use(remarkSmartypants).runSync(plain);
      for (const { original, copy } of pairs) {
        if (original.value !== copy.value) converted.set(keyOf(original), copy.value);
      }
    },
    text(node) {
      const value = converted.get(keyOf(node));
      if (value !== undefined) return { ...node, value };
    },
  });
};

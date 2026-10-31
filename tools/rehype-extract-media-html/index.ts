import type { Root } from 'hast';
import type { Plugin } from 'unified';
import { SKIP, visit } from 'unist-util-visit';
import { extractMediaHtml } from './extract.ts';

const rehypeExtractMediaHtml: Plugin<[], Root> = () => {
  return (tree: Root) => {
    visit(tree, 'raw', (node, index, parent) => {
      if (typeof node.value !== 'string') return;
      if (!parent || typeof index !== 'number') return;
      const children = extractMediaHtml(node.value);
      if (!children) return;
      parent.children.splice(index, 1, ...children);
      return [SKIP, index + children.length];
    });
  };
};

export default rehypeExtractMediaHtml;

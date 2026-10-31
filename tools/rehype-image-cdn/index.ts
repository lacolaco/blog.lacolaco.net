import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { createImageCdnTransform, type ImageCdnOptions } from './transform.ts';

const rehypeImageCdn: Plugin<[ImageCdnOptions?], Root> = (options = {}) => {
  const transform = createImageCdnTransform(options);

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      const updates = transform(node.tagName, node.properties);
      if (updates) Object.assign(node.properties, updates);
    });
  };
};

export default rehypeImageCdn;

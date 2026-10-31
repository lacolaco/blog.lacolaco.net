import { defineHastPlugin } from 'satteri';
import { createImageCdnTransform, type ImageCdnOptions } from './transform.ts';

/** Sätteri 版。Markdown 記法の画像と、extract-media-html が element 化した生 HTML の img / video を書き換える */
export function satteriImageCdn(options: ImageCdnOptions = {}) {
  const transform = createImageCdnTransform(options);

  return defineHastPlugin({
    name: 'image-cdn',
    element: {
      filter: ['img', 'video'],
      visit(node, ctx) {
        const updates = transform(node.tagName, node.properties);
        if (!updates) return;
        for (const [key, value] of Object.entries(updates)) ctx.setProperty(node, key, value);
      },
    },
  });
}

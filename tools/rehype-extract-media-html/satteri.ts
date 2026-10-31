import type { RootContent } from 'hast';
import { toHtml } from 'hast-util-to-html';
import { defineMdastPlugin } from 'satteri';
import { createImageCdnTransform, type ImageCdnOptions } from '../rehype-image-cdn/transform.ts';
import { extractMediaHtml } from './extract.ts';

function applyImageCdn(nodes: RootContent[], transform: ReturnType<typeof createImageCdnTransform>) {
  for (const node of nodes) {
    if (node.type !== 'element') continue;
    const updates = transform(node.tagName, node.properties);
    if (updates) Object.assign(node.properties, updates);
    applyImageCdn(node.children, transform);
  }
}

/**
 * Sätteri 版。対象の生 HTML を展開し、画像と動画の CDN 書き換えまで済ませてから、
 * unified の rehype-stringify と同じ hast-util-to-html で HTML に戻して html ノードに入れる。
 * Sätteri 自身の出力に任せると、属性名のエスケープなど表記が unified の出力と変わるため
 */
export function satteriExtractMediaHtml(options: ImageCdnOptions = {}) {
  const transform = createImageCdnTransform(options);

  return defineMdastPlugin({
    name: 'extract-media-html',
    html(node) {
      const children = extractMediaHtml(node.value);
      if (!children) return;
      applyImageCdn(children, transform);
      return { type: 'html', value: toHtml({ type: 'root', children }, { allowDangerousHtml: true }) };
    },
  });
}

import type { Element, Root } from 'hast';
import { imageSize } from 'image-size';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

const SRCSET_WIDTHS = [480, 768, 1024, 1536];
const SIZES = '(min-width: 768px) 768px, calc(100vw - 32px)';
const RESIZABLE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

interface Options {
  baseUrl?: string;
  publicDir?: string;
}

const rehypeImageCdn: Plugin<[Options?], Root> = (options = {}) => {
  const baseUrl = (options.baseUrl || process.env.IMAGE_CDN_BASE_URL)?.replace(/\/$/, '');
  const publicDir = options.publicDir || join(process.cwd(), 'public');
  const dimensionCache = new Map<string, { width: number; height: number }>();

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName !== 'img') return;

      const src = node.properties.src;
      if (typeof src !== 'string' || !src.startsWith('/images/')) return;

      const ext = extname(new URL(src, 'http://x').pathname).toLowerCase();
      const cdnPath = src.slice('/images'.length);

      // width/height（CLS 防止）
      try {
        const filePath = join(publicDir, decodeURIComponent(src));
        let cached = dimensionCache.get(filePath);
        if (!cached) {
          const dimensions = imageSize(readFileSync(filePath));
          if (dimensions.width && dimensions.height) {
            cached = { width: dimensions.width, height: dimensions.height };
            dimensionCache.set(filePath, cached);
          }
        }
        if (cached && !(node.properties.width && node.properties.height)) {
          node.properties.width = cached.width;
          node.properties.height = cached.height;
        }
      } catch {
        console.warn(`[rehype-image-cdn] Could not read image: ${join(publicDir, decodeURIComponent(src))}`);
      }

      // loading/decoding
      if (!node.properties.loading) {
        node.properties.loading = 'lazy';
      }
      if (!node.properties.decoding) {
        node.properties.decoding = 'async';
      }

      // CDN URL が設定されている場合のみ
      if (!baseUrl) return;

      // src → raw CDN URL
      node.properties.src = `${baseUrl}${cdnPath}`;

      // srcset/sizes はリサイズ可能な形式のみ
      if (RESIZABLE_EXTENSIONS.has(ext)) {
        node.properties.srcSet = SRCSET_WIDTHS.map(
          (w) => `${baseUrl}/cdn-cgi/image/width=${w},format=auto${cdnPath} ${w}w`,
        ).join(', ');
        node.properties.sizes = SIZES;
      }
    });
  };
};

export default rehypeImageCdn;

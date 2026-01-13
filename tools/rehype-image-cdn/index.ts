import type { Element, Root } from 'hast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * 画像URLを外部CDNに書き換えるrehypeプラグイン
 *
 * 環境変数 IMAGE_CDN_BASE_URL が設定されている場合、
 * /images/ で始まる画像パスを外部URLに書き換える
 *
 * 例: IMAGE_CDN_BASE_URL=https://images.blog.lacolaco.net
 *     /images/foo/bar.png → https://images.blog.lacolaco.net/foo/bar.png
 */

interface RehypeImageCdnOptions {
  baseUrl?: string;
}

const rehypeImageCdn: Plugin<[RehypeImageCdnOptions?], Root> = (options = {}) => {
  const baseUrl = options.baseUrl || process.env.IMAGE_CDN_BASE_URL;

  // baseUrlが設定されていない場合は何もしない
  if (!baseUrl) {
    return () => {};
  }

  // 末尾のスラッシュを除去
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      // img要素のsrc属性を変換
      if (node.tagName === 'img' && node.properties.src) {
        const src = String(node.properties.src);
        if (src.startsWith('/images/')) {
          node.properties.src = `${normalizedBaseUrl}${src.replace('/images', '')}`;
        }
      }
    });
  };
};

export default rehypeImageCdn;

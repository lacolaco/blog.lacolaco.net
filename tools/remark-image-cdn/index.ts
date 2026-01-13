import type { Image, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

/**
 * 画像URLを外部CDNに書き換えるremarkプラグイン
 *
 * 環境変数 IMAGE_CDN_BASE_URL が設定されている場合、
 * /images/ で始まる画像パスを外部URLに書き換える
 *
 * 例: IMAGE_CDN_BASE_URL=https://images.blog.lacolaco.net
 *     /images/foo/bar.png → https://images.blog.lacolaco.net/foo/bar.png
 */

interface RemarkImageCdnOptions {
  baseUrl?: string;
}

const remarkImageCdn: Plugin<[RemarkImageCdnOptions?], Root> = (options = {}) => {
  const baseUrl = options.baseUrl || process.env.IMAGE_CDN_BASE_URL;

  // baseUrlが設定されていない場合は何もしない
  if (!baseUrl) {
    return () => {};
  }

  // 末尾のスラッシュを除去
  const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

  return (tree: Root) => {
    visit(tree, 'image', (node: Image) => {
      // /images/ で始まるローカルパスのみ変換（/images/ プレフィックスは除去）
      if (node.url.startsWith('/images/')) {
        node.url = `${normalizedBaseUrl}${node.url.replace('/images', '')}`;
      }
    });
  };
};

export default remarkImageCdn;

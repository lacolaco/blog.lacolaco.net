import type { Html, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { EmbedConfig } from './handlers.ts';
import { createEmbedHandlers } from './handlers.ts';

// プラグインのオプション型
interface RemarkEmbedOptions {
  config?: Partial<EmbedConfig>;
}

const remarkEmbed: Plugin<[RemarkEmbedOptions?], Root> = (options = {}) => {
  // ユーザー設定をそのまま渡す（デフォルト設定は各ハンドラー内で処理）
  const config: EmbedConfig = {
    youtube: options.config?.youtube || {},
    webpage: options.config?.webpage || {},
    tweet: options.config?.tweet || {},
    stackblitz: options.config?.stackblitz || {},
    googleSlides: options.config?.googleSlides || {},
  } as EmbedConfig;

  // 設定に基づいてハンドラーを生成
  const embedHandlers = createEmbedHandlers(config);

  return async (tree: Root) => {
    const promises: Promise<void>[] = [];

    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      // 親がルートノードでない場合は処理しない
      if (!parent || parent.type !== 'root') {
        return;
      }

      // リンク形式のパラグラフをチェック
      if (node.children.length !== 1 || node.children[0].type !== 'link') {
        return; // リンクが1つだけでない場合は何もしない
      }

      const link = node.children[0];

      // リンクに明示的なタイトルがある場合は処理しない
      if (link.title) {
        return;
      }

      const url = link.url;

      if (!url) {
        console.warn('Link has no URL:', link);
        return; // URLがない場合は何もしない
      }

      // URL パターンに基づいてハンドラーを検索
      const handler = embedHandlers.find((h) => h.test(url));

      if (!handler) {
        console.warn(`No handler found for URL: ${url}`);
        return; // どのハンドラーにもマッチしない場合は何もしない
      }

      const transformResult = handler.transform(url);
      const promise = Promise.resolve(transformResult).then((htmlValue) => {
        if (htmlValue && index !== undefined) {
          const htmlNode: Html = { type: 'html', value: htmlValue };
          parent.children[index] = htmlNode;
        }
      });
      promises.push(promise);
    });

    await Promise.all(promises);
  };
};

export default remarkEmbed;

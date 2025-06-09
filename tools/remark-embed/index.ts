import type { Html, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { EmbedConfig, EmbedHandler } from './handlers.ts';
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

      let handler: EmbedHandler | undefined;
      let url: string | undefined;

      // リンク形式のパラグラフをチェック
      if (node.children.length === 1 && node.children[0].type === 'link') {
        const link = node.children[0];
        url = link.url;

        // リンクに明示的なタイトルがある場合は処理しない
        if (link.title) {
          return;
        }

        // URL パターンに基づいてハンドラーを検索
        handler = embedHandlers.find((h) => h.test(url!));
      }

      if (!handler || !url) {
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

import type { Html, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import type { EmbedConfig, EmbedHandler } from './handlers.ts';
import { createEmbedHandlers } from './handlers.ts';

// @[embedType](url) 形式のパターンを解析する関数
function parseEmbedPattern(text: string): { type: string; url: string } | null {
  const match = text.match(/^@\[(\w+)\]\(([^)]+)\)$/);
  if (!match) {
    return null;
  }
  return {
    type: match[1],
    url: match[2],
  };
}

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

      // パターン1: @[embedType](url) 形式をチェック（@の後にリンクがある場合）
      if (
        node.children.length === 2 &&
        node.children[0].type === 'text' &&
        node.children[0].value === '@' &&
        node.children[1].type === 'link'
      ) {
        const link = node.children[1];
        const embedType = link.children.length === 1 && link.children[0].type === 'text' ? link.children[0].value : '';

        if (embedType) {
          // embedType に基づいてハンドラーを検索
          handler = embedHandlers.find((h) => h.testEmbedType?.(embedType));
          url = link.url;
        }
      }

      // パターン2: 従来のテキスト形式の @[embedType](url) をチェック
      if (!handler && node.children.length === 1 && node.children[0].type === 'text') {
        const text = node.children[0].value;
        const embedPattern = parseEmbedPattern(text);

        if (embedPattern) {
          // embedType に基づいてハンドラーを検索
          handler = embedHandlers.find((h) => h.testEmbedType?.(embedPattern.type));
          url = embedPattern.url;
        }
      }

      // パターン3: 従来のリンク形式をチェック（上記の形式でマッチしなかった場合）
      if (!handler && node.children.length === 1 && node.children[0].type === 'link') {
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

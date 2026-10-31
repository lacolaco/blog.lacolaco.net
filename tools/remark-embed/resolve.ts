import type { EmbedConfig } from './handlers.ts';
import { createEmbedHandlers } from './handlers.ts';

export interface RemarkEmbedOptions {
  config?: Partial<EmbedConfig>;
}

export interface EmbedLink {
  url: string;
  // リンクの表示文字列
  text: string;
  // 原文でリンクが書かれていた範囲の文字列。位置が取れないときは undefined
  sourceText: string | undefined;
}

/**
 * 単独行のリンクを埋め込みの HTML に変換する関数を作る。
 * unified (remark) と Sätteri のどちらのプラグインからも同じ判定と変換を使う。
 * 埋め込みにしないリンクは undefined を返す
 */
export function createEmbedResolver(options: RemarkEmbedOptions = {}) {
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

  return (link: EmbedLink): Promise<string | undefined> | string | undefined => {
    const { url } = link;

    // リンクに明示的なタイトルがある場合は処理しない
    if (link.text !== url) {
      console.debug('Link has explicit text, skipping:', link.text);
      return;
    }

    if (!url) {
      console.warn('Link has no URL:', link);
      return; // URLがない場合は何もしない
    }

    // リンク記法や山括弧の自動リンクではなく、URLがそのまま書かれた行か
    const isBareUrl = link.sourceText === url;

    // URL パターンに基づいてハンドラーを検索
    const handler = embedHandlers.find((h) => (isBareUrl || !h.bareUrlOnly) && h.test(url));

    if (!handler) {
      console.warn(`No handler found for URL: ${url}`);
      return; // どのハンドラーにもマッチしない場合は何もしない
    }

    return handler.transform(url);
  };
}

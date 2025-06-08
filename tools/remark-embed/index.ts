import * as cheerio from 'cheerio';
import type { Html, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { escapeHtml } from './escape-html.ts';

// 設定インターフェース
interface EmbedConfig {
  youtube: {
    width: number;
    height: number;
    allowAttributes: string[];
  };
  webpage: {
    timeout: number;
    fallbackTitle: string;
  };
  tweet: {
    fallbackText: string;
  };
  stackblitz: {
    width: string;
    height: number;
  };
  googleSlides: {
    width: string;
    height: number;
  };
}

// 埋め込みハンドラーのインターフェース
interface EmbedHandler {
  name: string;
  test: (url: string) => boolean;
  transform: (url: string) => Promise<string | undefined> | string;
}

// 埋め込みハンドラーファクトリ関数
function createTweetHandler(): EmbedHandler {
  return {
    name: 'tweet',
    test: (url: string) => {
      return url.startsWith('https://twitter.com/') || url.startsWith('https://x.com/');
    },
    transform: (url: string) => {
      const safeUrl = new URL(url);
      return `
<div class="block-link block-link-tweet">
  <blockquote class="twitter-tweet">
    <a href="${safeUrl.toString()}">${safeUrl.toString()}</a>
  </blockquote>
</div>
      `.trim();
    },
  };
}

function createYouTubeHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'youtube',
    test: (url: string) => {
      return (
        url.startsWith('https://youtube.com/') ||
        url.startsWith('https://www.youtube.com/') ||
        url.startsWith('http://youtube.com/') ||
        url.startsWith('http://www.youtube.com/') ||
        url.startsWith('https://youtu.be/') ||
        url.startsWith('http://youtu.be/')
      );
    },
    transform: (url: string) => {
      const defaultYouTubeConfig = {
        width: 560,
        height: 315,
        allowAttributes: [
          'accelerometer',
          'autoplay',
          'clipboard-write',
          'encrypted-media',
          'gyroscope',
          'picture-in-picture',
        ],
      };
      const youtubeConfig = { ...defaultYouTubeConfig, ...config.youtube };

      const match = url.match(
        /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      );
      const videoId = match ? match[1] : undefined;
      if (!videoId) {
        throw new Error(`Invalid YouTube URL: ${url}`);
      }

      const { width, height, allowAttributes } = youtubeConfig;
      const allowAttributesStr = allowAttributes.join('; ');

      const embedUrl = new URL('https://www.youtube.com/embed/');
      embedUrl.pathname += videoId;

      return `
<div class="block-link block-link-youtube">
  <iframe
    width="${width}"
    height="${height}"
    src="${embedUrl.toString()}"
    style="border: none;"
    allow="${allowAttributesStr}"
    allowfullscreen
  ></iframe>
</div>
      `.trim();
    },
  };
}

function createStackblitzHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'stackblitz',
    test: (url: string) => {
      if (!url.startsWith('https://stackblitz.com/')) {
        return false;
      }
      // embed=1パラメータがある場合のみiframe化する
      const urlObj = new URL(url);
      return urlObj.searchParams.get('embed') === '1';
    },
    transform: (url: string) => {
      const defaultStackblitzConfig = {
        width: '100%',
        height: 400,
      };
      const stackblitzConfig = { ...defaultStackblitzConfig, ...config.stackblitz };

      const { width, height } = stackblitzConfig;
      const safeUrl = new URL(url);

      return `
<div class="block-link block-link-stackblitz">
  <iframe
    width="${width}"
    height="${height}"
    src="${safeUrl.toString()}"
    style="border: none;"
    loading="lazy"
  ></iframe>
</div>
      `.trim();
    },
  };
}

function createGoogleSlidesHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'googleSlides',
    test: (url: string) => {
      if (!url.includes('docs.google.com/presentation')) {
        return false;
      }
      try {
        const urlObj = new URL(url);
        return urlObj.pathname.endsWith('/pub');
      } catch {
        return false;
      }
    },
    transform: (url: string) => {
      const defaultGoogleSlidesConfig = {
        width: '100%',
        height: 480,
      };
      const googleSlidesConfig = { ...defaultGoogleSlidesConfig, ...config.googleSlides };

      const { width, height } = googleSlidesConfig;
      // パス末尾の/pubを/embedに変換（クエリパラメータは保持）
      const urlObj = new URL(url);
      urlObj.pathname = urlObj.pathname.replace(/\/pub$/, '/embed');
      const embedUrl = urlObj.toString();

      return `
<div class="block-link block-link-google-slides">
  <iframe
    width="${width}"
    height="${height}"
    src="${embedUrl}"
    style="border: none;"
    allowfullscreen
    loading="lazy"
  ></iframe>
</div>
      `.trim();
    },
  };
}

function createDefaultHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'default',
    test: (url: string) => {
      return url.startsWith('https://') || url.startsWith('http://');
    },
    transform: async (url: string) => {
      const defaultWebPageConfig = {
        timeout: 5000,
        fallbackTitle: 'Web Page',
      };
      const webpageConfig = { ...defaultWebPageConfig, ...config.webpage };

      const { timeout, fallbackTitle } = webpageConfig;

      try {
        // タイムアウト付きでフェッチ
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.warn(`Failed to fetch web page info for ${url}: ${response.status} ${response.statusText}`);
          return undefined; // 失敗時はundefinedを返す
        }
        const html = await response.text();
        const $ = cheerio.load(html);

        const title = $('meta[property="og:title"]').attr('content') || $('title').text();
        const description =
          $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
        const imageUrl = $('meta[property="og:image"]').attr('content');
        const canonicalUrl = $('meta[property="og:url"]').attr('content') || url;
        const safeCanonicalUrl = new URL(canonicalUrl);
        const safeImageUrl = imageUrl ? new URL(imageUrl) : null;

        const escapedTitle = escapeHtml(title || fallbackTitle);
        const escapedDescription = description ? escapeHtml(description) : '';

        return `
<a href="${safeCanonicalUrl.toString()}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
  <div class="webpage-card-content">
    <h3 class="webpage-card-title">${escapedTitle}</h3>
    ${escapedDescription ? `<p class="webpage-card-description">${escapedDescription}</p>` : ''}
  </div>
  ${safeImageUrl ? `<img src="${safeImageUrl.toString()}" alt="Page image" class="webpage-card-image">` : ''}
</a>
        `.trim();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.warn(`Timeout fetching web page info for ${url}`);
        } else {
          console.error(`Failed to fetch web page info for ${url}:`, error);
        }
        return undefined; // エラー時はundefinedを返す
      }
    },
  };
}

// 埋め込みハンドラーの定義（設定を受け取る関数として）
function createEmbedHandlers(config: EmbedConfig): EmbedHandler[] {
  return [
    createTweetHandler(),
    createYouTubeHandler(config),
    createStackblitzHandler(config),
    createGoogleSlidesHandler(config),
    createDefaultHandler(config), // 最も広範囲なので最後に配置
  ];
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

      // 子ノードがリンクでない場合は処理しない
      if (node.children.length !== 1 || node.children[0].type !== 'link') {
        return;
      }

      const link = node.children[0];
      const url = link.url;

      // リンクに明示的なタイトルがある場合は処理しない
      if (link.title) {
        return;
      }

      // 各ハンドラーを順番に試して、最初にマッチしたものを使用
      const handler = embedHandlers.find((h) => h.test(url));
      if (!handler) {
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

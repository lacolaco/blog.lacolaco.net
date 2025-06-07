import type { Root, Paragraph, Link, Html, Parent } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import * as cheerio from 'cheerio';

// HTMLエスケープ処理
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return text.replace(/[&<>"']/g, (match) => htmlEscapeMap[match]);
}

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
}

// 埋め込みハンドラーのインターフェース
interface EmbedHandler {
  name: string;
  test: (url: string) => boolean;
  transform: (url: string) => Promise<string | undefined> | string;
}

// HTMLノードを作成して親ノードの指定位置に置換する共通関数
function replaceWithHtmlNode(parent: Parent, index: number, htmlValue: string): void {
  const htmlNode: Html = {
    type: 'html',
    value: htmlValue,
  };
  parent.children[index] = htmlNode;
}

function createTweetEmbedHtml(url: string, config: EmbedConfig): string {
  const escapedUrl = escapeHtml(url);
  return `
<div class="block-link block-link-tweet">
  <blockquote class="twitter-tweet">
    <a href="${escapedUrl}">${escapedUrl}</a>
  </blockquote>
</div>
  `.trim();
}

function extractYouTubeVideoId(url: string): string | undefined {
  const match = url.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : undefined;
}

function createYouTubeEmbedHtml(url: string, config: EmbedConfig): string {
  const videoId = extractYouTubeVideoId(url);
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${url}`);
  }

  const escapedVideoId = escapeHtml(videoId);
  const { width, height, allowAttributes } = config.youtube;
  const allowAttributesStr = allowAttributes.join('; ');

  return `
<div class="block-link block-link-youtube">
  <iframe
    width="${width}"
    height="${height}"
    src="https://www.youtube.com/embed/${escapedVideoId}"
    style="border: none;"
    allow="${allowAttributesStr}"
    allowfullscreen
  ></iframe>
</div>
  `.trim();
}

async function createDefaultEmbeddedLinkHtml(url: string, config: EmbedConfig): Promise<string | undefined> {
  const { timeout, fallbackTitle } = config.webpage;

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

    const escapedUrl = escapeHtml(canonicalUrl);
    const escapedTitle = escapeHtml(title || fallbackTitle);
    const escapedDescription = description ? escapeHtml(description) : '';
    const escapedImageUrl = imageUrl ? escapeHtml(imageUrl) : '';

    return `
<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
  <div class="webpage-card-content">
    <h3 class="webpage-card-title">${escapedTitle}</h3>
    ${escapedDescription ? `<p class="webpage-card-description">${escapedDescription}</p>` : ''}
  </div>
  ${escapedImageUrl ? `<img src="${escapedImageUrl}" alt="Page image" class="webpage-card-image">` : ''}
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
}

// 埋め込みハンドラーの定義（設定を受け取る関数として）
function createEmbedHandlers(config: EmbedConfig): EmbedHandler[] {
  const tweetHandler: EmbedHandler = {
    name: 'tweet',
    test: (url: string) => {
      return url.startsWith('https://twitter.com/') || url.startsWith('https://x.com/');
    },
    transform: (url: string) => {
      const defaultTweetConfig = { fallbackText: 'Tweet' };
      const tweetConfig = { ...defaultTweetConfig, ...config.tweet };
      return createTweetEmbedHtml(url, { ...config, tweet: tweetConfig });
    },
  };

  const youtubeHandler: EmbedHandler = {
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
      return createYouTubeEmbedHtml(url, { ...config, youtube: youtubeConfig });
    },
  };

  const defaultHandler: EmbedHandler = {
    name: 'default',
    test: (url: string) => {
      return url.startsWith('https://') || url.startsWith('http://');
    },
    transform: (url: string) => {
      const defaultWebPageConfig = {
        timeout: 5000,
        fallbackTitle: 'Web Page',
      };
      const webpageConfig = { ...defaultWebPageConfig, ...config.webpage };
      return createDefaultEmbeddedLinkHtml(url, { ...config, webpage: webpageConfig });
    },
  };

  return [
    tweetHandler,
    youtubeHandler,
    defaultHandler, // 最も広範囲なので最後に配置
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

      const link = node.children[0] as Link;
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
        if (htmlValue && parent && index !== undefined) {
          replaceWithHtmlNode(parent, index, htmlValue);
        }
      });
      promises.push(promise);
    });

    await Promise.all(promises);
  };
};

export default remarkEmbed;

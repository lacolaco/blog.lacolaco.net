import type { Root, Paragraph, Link, Html } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import * as cheerio from 'cheerio';

function isTweetUrl(url: string): string | undefined {
  const match = url.match(/^https:\/\/(?:twitter|x)\.com\/[^/]+\/status\/(\d+)/);
  return match ? match[0] : undefined;
}

function createTweetEmbedHtml(tweetUrl: string, originalUrl: string): string {
  return `
<div class="block-link block-link-tweet">
  <blockquote class="twitter-tweet">
    <a href="${tweetUrl}">${originalUrl}</a>
  </blockquote>
</div>
  `.trim();
}

function isYouTubeUrl(url: string): string | undefined {
  const match = url.match(
    /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : undefined; // videoIdを返す
}

function createYouTubeEmbedHtml(videoId: string): string {
  return `
<div class="block-link block-link-youtube">
  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/${videoId}"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</div>
  `.trim();
}

function isWebPageUrl(url: string): string | undefined {
  // http(s)://で始まる任意のURLを対象とする
  const match = url.match(/^https?:\/\/[^/]+\/.*/);
  return match ? url : undefined;
}

async function createWebPageEmbedHtml(pageUrl: string): Promise<string | undefined> {
  // undefinedを返す可能性を追加
  try {
    const response = await fetch(pageUrl);
    if (!response.ok) {
      console.warn(`Failed to fetch web page info for ${pageUrl}: ${response.status} ${response.statusText}`);
      return undefined; // 失敗時はundefinedを返す
    }
    const html = await response.text();
    const $ = cheerio.load(html);

    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const description =
      $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content');
    const imageUrl = $('meta[property="og:image"]').attr('content');
    const url = $('meta[property="og:url"]').attr('content') || pageUrl;

    return `
<a href="${url}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
  <div class="webpage-card-content">
    <h3 class="webpage-card-title">${title || 'Web Page'}</h3>
    ${description ? `<p class="webpage-card-description">${description}</p>` : ''}
  </div>
  ${imageUrl ? `<img src="${imageUrl}" alt="Page image" class="webpage-card-image">` : ''}
</a>
    `.trim();
  } catch (error) {
    console.error(`Failed to fetch web page info for ${pageUrl}:`, error);
    return undefined; // エラー時はundefinedを返す
  }
}

const remarkEmbed: Plugin<[], Root> = () => {
  return async (tree: Root) => {
    const promises: Promise<void>[] = [];

    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      // 親がルートノードでない場合は処理しない
      if (!parent || parent.type !== 'root') {
        return;
      }

      if (node.children.length !== 1) {
        return;
      }

      const child = node.children[0];
      if (child.type !== 'link') {
        return;
      }

      const link = child as Link;
      const url = link.url;

      // リンクに明示的なテキストがある場合（URLとテキストが異なる場合）は変換しない
      if (link.children.length === 1 && link.children[0].type === 'text' && link.children[0].value !== link.url) {
        return;
      }

      const tweetUrl = isTweetUrl(url);
      const youtubeVideoId = isYouTubeUrl(url);
      const webPageUrl = isWebPageUrl(url);

      if (tweetUrl) {
        const htmlValue = createTweetEmbedHtml(tweetUrl, url);
        const htmlNode: Html = {
          type: 'html',
          value: htmlValue,
        };
        if (parent && index !== undefined) {
          parent.children[index] = htmlNode;
        }
      } else if (youtubeVideoId) {
        const htmlValue = createYouTubeEmbedHtml(youtubeVideoId);
        const htmlNode: Html = {
          type: 'html',
          value: htmlValue,
        };
        if (parent && index !== undefined) {
          parent.children[index] = htmlNode;
        }
      } else if (webPageUrl) {
        // webPageUrlがundefinedでない場合にのみ処理
        // 非同期処理をPromiseとして収集
        const promise = createWebPageEmbedHtml(webPageUrl).then((htmlValue) => {
          if (htmlValue) {
            // htmlValueがundefinedでない場合のみノードを置き換える
            const htmlNode: Html = {
              type: 'html',
              value: htmlValue,
            };
            if (parent && index !== undefined) {
              parent.children[index] = htmlNode;
            }
          }
        });
        promises.push(promise);
      }
      // どの埋め込みにもマッチしない場合は何もしない（元のリンクのまま）
    });

    await Promise.all(promises);
  };
};

export default remarkEmbed;

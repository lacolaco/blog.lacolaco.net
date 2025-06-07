import type { Html, Link, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';

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

const remarkEmbed: Plugin<[], Root> = () => {
  return (tree: Root) => {
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

      let htmlValue: string | undefined;

      const tweetUrl = isTweetUrl(url);
      if (tweetUrl) {
        htmlValue = createTweetEmbedHtml(tweetUrl, url);
      }

      const youtubeVideoId = isYouTubeUrl(url);
      if (youtubeVideoId) {
        htmlValue = createYouTubeEmbedHtml(youtubeVideoId);
      }

      if (htmlValue) {
        const htmlNode: Html = {
          type: 'html',
          value: htmlValue,
        };

        // パラグラフノード自体をHTMLノードに置き換える
        if (parent && index !== undefined) {
          parent.children[index] = htmlNode;
        }
      }
    });
  };
};

export default remarkEmbed;

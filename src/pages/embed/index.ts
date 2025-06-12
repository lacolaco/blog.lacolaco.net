import type { APIContext } from 'astro';
import { load, type CheerioAPI } from 'cheerio';

export const prerender = false;

// 定数
const DEFAULT_CACHE_MAX_AGE = 60 * 60; // 1 hour
const AMAZON_URL_PREFIXES = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];
const GOOGLEBOT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const DEFAULT_USER_AGENT = 'blog.lacolaco.net';

// 型定義
interface PageMetadata {
  title: string;
  description: string;
  imageUrl: string | null;
  cacheControl: string | null;
}

interface FetchConfig {
  userAgent: string;
  cacheTtl: number;
}

/**
 * `/embed` エンドポイントのハンドラー
 * このエンドポイントは、指定されたURLのメタデータを取得し、Webページカードとして埋め込むHTMLを生成します。
 * `url` パラメータで指定されたURLのメタデータを取得し、カード形式で表示します。
 *
 * @param context
 * @returns
 */
export async function GET(context: APIContext): Promise<Response> {
  const url = new URL(decodeURIComponent(context.request.url)).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const metadata = await fetchPageMetadata(url);
  const html = buildEmbedHtml(metadata, url);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': metadata.cacheControl || `max-age=${DEFAULT_CACHE_MAX_AGE}`,
    },
  });
}

// ヘルパー関数
function getFetchConfig(url: string): FetchConfig {
  const isAmazonRequest = AMAZON_URL_PREFIXES.some((domain) => url.startsWith(domain));
  return {
    userAgent: isAmazonRequest ? GOOGLEBOT_USER_AGENT : DEFAULT_USER_AGENT,
    cacheTtl: DEFAULT_CACHE_MAX_AGE,
  };
}

function extractTitle($: CheerioAPI, fallbackUrl: string): string {
  const metaOgTitle = $('head>meta[property="og:title"]').attr('content');
  if (metaOgTitle) return metaOgTitle;

  const metaTitle = $('head>meta[name="title"]').attr('content');
  if (metaTitle) return metaTitle;

  const docTitle = $('title').text();
  if (docTitle) return docTitle;

  return fallbackUrl;
}

function extractDescription($: CheerioAPI): string {
  const metaOgDescription = $('head>meta[property="og:description"]').attr('content');
  if (metaOgDescription) return metaOgDescription;

  const metaDescription = $('head>meta[name="description"]').attr('content');
  if (metaDescription) return metaDescription;

  const metaTwitterDescription = $('head>meta[name="twitter:description"]').attr('content');
  if (metaTwitterDescription) return metaTwitterDescription;

  return '';
}

function extractImageUrl($: CheerioAPI): string | null {
  const metaOgImage = $('head>meta[property="og:image"]').attr('content');
  if (metaOgImage) return metaOgImage;

  const metaTwitterImage = $('head>meta[name="twitter:image"]').attr('content');
  if (metaTwitterImage) return metaTwitterImage;

  const metaImage = $('head>meta[name="image"]').attr('content');
  if (metaImage) return metaImage;

  const firstImg = $('img').first().attr('src');
  if (firstImg) return firstImg;

  return null;
}

async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const config = getFetchConfig(url);

  const response = await fetch(url, {
    cf: {
      cacheTtlByStatus: { '200-299': config.cacheTtl, 404: 1, '500-599': 0 },
    },
    headers: {
      'user-agent': config.userAgent,
      accept: 'text/html',
      'accept-charset': 'utf-8',
    },
  });

  const html = await response.text();
  const $ = load(html);

  return {
    title: extractTitle($, url),
    description: extractDescription($),
    imageUrl: extractImageUrl($),
    cacheControl: response.headers.get('cache-control'),
  };
}

function getEmbedStyles(): string {
  return `
    html, body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
    }

    .block-link {
      display: flex;
      margin: 0;
    }

    .webpage-card {
      display: flex;
      align-items: center;
      height: 7rem;
      gap: 1rem;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      transition: box-shadow 200ms;
      background: #fff;
      text-decoration: none;
      color: inherit;
    }

    .webpage-card:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      text-decoration: underline;
    }

    .webpage-card-image {
      height: 100%;
      aspect-ratio: 16/9;
      flex-shrink: 0;
      object-fit: cover;
    }

    .webpage-card-content {
      flex-grow: 1;
      overflow: hidden;
      padding: 0 1rem;
    }

    .webpage-card-title {
      margin: 0.5rem 0;
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .webpage-card-description {
      margin: 0.5rem 0;
      font-size: 0.875rem;
      color: #4b5563;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;
}

function buildEmbedHtml(metadata: PageMetadata, url: string): string {
  const { title, description, imageUrl } = metadata;
  const displayDescription = description || new URL(url).hostname;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <meta name="robots" content="noindex" />
        <title>${title}</title>
        <style>${getEmbedStyles()}</style>
      </head>
      <body>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
          <div class="webpage-card-content">
            <h3 class="webpage-card-title">${title}</h3>
            <p class="webpage-card-description">${displayDescription}</p>
          </div>
          ${imageUrl ? `<img src="${imageUrl}" alt="Page image" class="webpage-card-image">` : ''}
        </a>
      </body>
    </html>
  `;
}

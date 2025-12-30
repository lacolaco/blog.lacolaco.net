import type { APIContext } from 'astro';
import { load, type CheerioAPI } from 'cheerio';
import pRetry, { AbortError } from 'p-retry';
import escapeHtml from 'escape-html';

export const prerender = false;

// 定数
const DEFAULT_CACHE_MAX_AGE = 60 * 60; // 1 hour
const FETCH_TIMEOUT_MS = 10000; // 10 seconds per request
const AMAZON_URL_PREFIXES = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
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
    userAgent: isAmazonRequest ? CHROME_USER_AGENT : DEFAULT_USER_AGENT,
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

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const config = getFetchConfig(url);

  try {
    const response = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              'user-agent': config.userAgent,
              accept: 'text/html',
              'accept-charset': 'utf-8',
              'accept-language': 'ja, en;q=0.9',
            },
          });

          clearTimeout(timeoutId);

          // 4xx系エラーはリトライしない
          if (res.status >= 400 && res.status < 500) {
            throw new AbortError(`Client error: ${res.status}`);
          }

          // 5xx系エラーはリトライ対象
          if (!res.ok) {
            throw new Error(`Server error: ${res.status}`);
          }

          return res;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      },
      {
        retries: 3,
        minTimeout: 1000, // 1秒
        maxTimeout: 4000, // 4秒
        factor: 2, // 指数バックオフ係数 (1秒 → 2秒 → 4秒)
        onFailedAttempt: (error) => {
          console.warn(`Retry ${error.attemptNumber}/3: ${url}`);
        },
      },
    );

    const html = await response.text();
    const $ = load(html);

    return {
      title: extractTitle($, url),
      description: extractDescription($),
      imageUrl: extractImageUrl($),
      cacheControl: response.headers.get('cache-control'),
    };
  } catch (error) {
    console.error(`Failed to fetch ${url}:`, error);
    return {
      title: url,
      description: '',
      imageUrl: null,
      cacheControl: 'max-age=60, must-revalidate',
    };
  }
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
      height: 5rem;
      gap: 1rem;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
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
      display: none;
    }

    .webpage-card-content {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      overflow: hidden;
      padding: 1rem 1rem;
      gap: 0.5rem;
    }

    .webpage-card-title {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .webpage-card-description {
      margin: 0;
      font-size: 0.8rem;
      color: #4b5563;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (min-width: 768px) {
      .webpage-card {
        height: 7rem;
      }
      
      .webpage-card-image {
        display: block;
      }
    }
  `;
}

function buildEmbedHtml(metadata: PageMetadata, url: string): string {
  const { title, imageUrl } = metadata;
  const displayDescription = new URL(url).hostname;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <meta name="robots" content="noindex" />
        <title>${escapeHtml(title)}</title>
        <style>${getEmbedStyles()}</style>
      </head>
      <body>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
          <div class="webpage-card-content">
            <h3 class="webpage-card-title">${escapeHtml(title)}</h3>
            <p class="webpage-card-description">${escapeHtml(displayDescription)}</p>
          </div>
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Page image" class="webpage-card-image">` : ''}
        </a>
      </body>
    </html>
  `;
}

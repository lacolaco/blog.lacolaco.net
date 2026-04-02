import { load, type CheerioAPI } from 'cheerio';
import pRetry, { AbortError } from 'p-retry';

// 定数
const FETCH_TIMEOUT_MS = 10000; // 10 seconds per request
const AMAZON_URL_PREFIXES = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_USER_AGENT = 'blog.lacolaco.net';

// 型定義
export interface PageMetadata {
  title: string;
  description: string;
  imageUrl: string | null;
  cacheControl: string | null;
}

// ヘルパー関数
function getUserAgent(url: string): string {
  const isAmazonRequest = AMAZON_URL_PREFIXES.some((domain) => url.startsWith(domain));
  return isAmazonRequest ? CHROME_USER_AGENT : DEFAULT_USER_AGENT;
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

function extractImageUrl($: CheerioAPI, baseUrl: string): string | null {
  const candidates = [
    $('head>meta[property="og:image"]').attr('content'),
    $('head>meta[name="twitter:image"]').attr('content'),
    $('head>meta[name="image"]').attr('content'),
    $('img').first().attr('src'),
  ];

  const found = candidates.find((c) => c != null);
  if (!found) return null;

  try {
    return new URL(found, baseUrl).href;
  } catch {
    return found;
  }
}

export const DEFAULT_CACHE_MAX_AGE = 60 * 60; // 1 hour

export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const userAgent = getUserAgent(url);

  try {
    const response = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          const res = await fetch(url, {
            signal: controller.signal,
            headers: {
              'user-agent': userAgent,
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
          console.warn(`Attempt ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber} failed: ${url}`);
        },
      },
    );

    const html = await response.text();
    const $ = load(html);

    return {
      title: extractTitle($, url),
      description: extractDescription($),
      imageUrl: extractImageUrl($, url),
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

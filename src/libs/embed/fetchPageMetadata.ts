import { load, type CheerioAPI } from 'cheerio';
import pRetry, { AbortError } from 'p-retry';
import { request } from 'undici';

// 定数
const FETCH_TIMEOUT_MS = 10000; // 10 seconds per request
const AMAZON_URL_PREFIXES = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];
const GOOGLEBOT_USER_AGENT =
  'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const DEFAULT_USER_AGENT = 'blog.lacolaco.net';

// 型定義
export interface PageMetadata {
  title: string;
  description: string;
  imageUrl: string | null;
  cacheControl: string | null;
}

interface FetchConfig {
  userAgent: string;
  cacheTtl: number;
}

// ヘルパー関数
function getFetchConfig(url: string): FetchConfig {
  const isAmazonRequest = AMAZON_URL_PREFIXES.some((domain) => url.startsWith(domain));
  return {
    userAgent: isAmazonRequest ? GOOGLEBOT_USER_AGENT : DEFAULT_USER_AGENT,
    cacheTtl: 3600, // 1 hour
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

/**
 * 指定されたURLのページメタデータを取得する
 * リトライ機能付きでHTTPリクエストを実行し、OGタグなどからメタデータを抽出する
 *
 * @param url - 取得対象のURL
 * @returns ページメタデータ
 */
export async function fetchPageMetadata(url: string): Promise<PageMetadata> {
  const config = getFetchConfig(url);

  try {
    const response = await pRetry(
      async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          const { statusCode, headers, body } = await request(url, {
            signal: controller.signal,
            method: 'GET',
            headers: {
              'user-agent': config.userAgent,
              accept: 'text/html',
              'accept-charset': 'utf-8',
            },
          });

          clearTimeout(timeoutId);

          // 4xx系エラーはリトライしない
          if (statusCode >= 400 && statusCode < 500) {
            throw new AbortError(`Client error: ${statusCode}`);
          }

          // 5xx系エラーはリトライ対象
          if (statusCode >= 500) {
            throw new Error(`Server error: ${statusCode}`);
          }

          return { statusCode, headers, body };
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

    const html = await response.body.text();
    const $ = load(html);

    return {
      title: extractTitle($, url),
      description: extractDescription($),
      imageUrl: extractImageUrl($),
      cacheControl: (response.headers['cache-control'] as string) || null,
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

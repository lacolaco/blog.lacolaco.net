import { load, type CheerioAPI } from 'cheerio';
import pRetry, { AbortError } from 'p-retry';

// 定数
const FETCH_TIMEOUT_MS = 10000; // 10 seconds per request
const AMAZON_URL_PREFIXES = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];
const CHROME_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const DEFAULT_USER_AGENT = 'blog.lacolaco.net';

// OGP/meta は <head> 内で完結するため body 全部は読まない。
// 巨大な SPA / Google Slides 等 (20MB+) を丸ごと cheerio.load すると Cloud Run の
// メモリと request timeout を食い潰して 503 になる。streaming で </head> を見つけたら
// 即 abort し、見つからなくても上限 byte で打ち切る (head 終端不明な壊れた HTML の保険)
const MAX_HTML_BYTES = 512 * 1024; // 512 KB
const HEAD_END_PATTERN = /<\/head\s*>/i;

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

  const found = candidates.find(Boolean);
  if (!found) return null;

  try {
    return new URL(found, baseUrl).href;
  } catch {
    return found;
  }
}

// response body を <head> 終端 or 上限 byte まで streaming で読む。
// body プロパティが存在しない場合 (テストの簡易 mock 等) は従来通り text() に fallback。
async function readHtmlHead(res: Response): Promise<string> {
  if (!res.body) {
    return await res.text();
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let total = 0;
  let acc = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      acc += decoder.decode(value, { stream: true });
      const idx = acc.search(HEAD_END_PATTERN);
      if (idx !== -1) {
        // </head> までを切り出して残りは読み捨て
        const endIdx = acc.indexOf('>', idx) + 1;
        acc = acc.slice(0, endIdx);
        break;
      }
      if (total >= MAX_HTML_BYTES) {
        // head 終端を見つけられないまま上限に達した。ここまでで切り上げる
        break;
      }
    }
    acc += decoder.decode();
  } finally {
    try {
      await reader.cancel();
    } catch {
      // cancel が rejected でも本処理には影響しない
    }
  }
  return acc;
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

    // content-type が HTML 系でなければ metadata 抽出は無意味なので fallback
    const contentType = response.headers.get('content-type') ?? '';
    if (contentType && !/text\/html|application\/xhtml/i.test(contentType)) {
      try {
        await response.body?.cancel();
      } catch {
        // cancel 失敗は無害
      }
      return {
        title: url,
        description: '',
        imageUrl: null,
        // Cache-Control 未設定 (PDF 等で一般的) なら catch ブロックの fallback と
        // 揃えて短期間 must-revalidate にする。毎リクエスト再 fetch を避ける
        cacheControl: response.headers.get('cache-control') ?? 'max-age=60, must-revalidate',
      };
    }

    const html = await readHtmlHead(response);
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

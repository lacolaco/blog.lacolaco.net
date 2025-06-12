import type { APIContext } from 'astro';
import { load } from 'cheerio';

// Type override for Cloudflare Workers cache API
declare const caches:
  | {
      default: Cache;
    }
  | undefined;

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const url = new URL(decodeURIComponent(context.request.url)).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const cacheKey = context.request;
  const cache = typeof caches === 'undefined' ? undefined : caches.default;
  // Skip cache check if cache is not available
  if (cache) {
    // Check if client requested cache bypass
    const shouldBypassCache = context.request.headers.get('cache-control')?.includes('no-cache');

    if (!shouldBypassCache) {
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }
    }
  }

  const { title, description, imageUrl } = await fetchPageMetadata(url);
  const html = buildEmbedHtml(title, description, url, imageUrl);
  const maxAge = 60 * 60 * 24; // 1 day
  const response = new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `max-age=${maxAge}`,
    },
  });
  await cache?.put(cacheKey, response.clone());
  return response;
}

const amazonUrlPrefixes = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];

async function fetchPageMetadata(
  url: string,
): Promise<{ title: string; description: string; imageUrl: string | null }> {
  const isAmazonRequest = amazonUrlPrefixes.some((domain) => url.startsWith(domain));
  const userAgent = isAmazonRequest
    ? // use Googlebot UA for Amazon to get server-side-rendered HTML
      // https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
      'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/W.X.Y.Z Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    : // use custom UA by default
      'blog.lacolaco.net';

  const response = await fetch(url, {
    headers: {
      'user-agent': userAgent,
      accept: 'text/html',
      'accept-charset': 'utf-8',
    },
  });
  const html = await response.text();
  const $ = load(html);
  const metaOgTitle = $('head>meta[property="og:title"]').attr('content');
  const metaTitle = $('head>meta[name="title"]').attr('content');
  const docTitle = $('title').text();
  const title = metaOgTitle || metaTitle || docTitle || url;

  // 説明文取得のフォールバック戦略
  const metaOgDescription = $('head>meta[property="og:description"]').attr('content');
  const metaDescription = $('head>meta[name="description"]').attr('content');
  const metaTwitterDescription = $('head>meta[name="twitter:description"]').attr('content');
  const description = metaOgDescription || metaDescription || metaTwitterDescription || '';

  // 画像取得のフォールバック戦略
  const metaOgImage = $('head>meta[property="og:image"]').attr('content');
  const metaTwitterImage = $('head>meta[name="twitter:image"]').attr('content');
  const metaImage = $('head>meta[name="image"]').attr('content');
  const firstImg = $('img').first().attr('src');

  const imageUrl = metaOgImage || metaTwitterImage || metaImage || firstImg || null;

  return { title, description, imageUrl };
}

function buildEmbedHtml(title: string, description: string, url: string, imageUrl: string | null) {
  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <meta name="robots" content="noindex" />
        <title>${title}</title>
        <style>
          html, body {
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji',
    'Segoe UI Emoji';
          }

          .block-link {
            display: flex;
            margin: 0;
          }

          .webpage-card {
            display: flex;
            align-items: center;
            height: 7rem; /* h-28 = 112px = 7rem */
            gap: 1rem; /* space-x-4 = 16px = 1rem */
            border-radius: 0.5rem; /* rounded-lg */
            border: 1px solid #e5e7eb; /* border-gray-200 */
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05); /* shadow-sm */
            transition: box-shadow 200ms; /* transition-shadow duration-200 */
            background: #fff;
            text-decoration: none;
            color: inherit;
          }

          .webpage-card:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05); /* hover:shadow-lg */
            text-decoration: underline; /* hover:underline */
          }

          .webpage-card-image {
            height: 100%; /* h-full */
            aspect-ratio: 16/9; /* aspect-video */
            flex-shrink: 0; /* flex-shrink-0 */
            object-fit: cover; /* object-cover */
          }

          .webpage-card-content {
            flex-grow: 1; /* flex-grow */
            overflow: hidden; /* overflow-hidden */
            padding: 0 1rem; /* px-4 */
          }

          .webpage-card-title {
            margin: 0.5rem 0; /* my-2 */
            font-size: 1rem; /* text-base */
            font-weight: 600; /* font-semibold */
            color: #111827; /* text-gray-900 */
            white-space: nowrap; /* whitespace-nowrap */
            overflow: hidden; /* overflow-hidden */
            text-overflow: ellipsis; /* text-ellipsis */
          }

          .webpage-card-description {
            margin: 0.5rem 0; /* my-2 */
            font-size: 0.875rem; /* text-sm */
            color: #4b5563; /* text-gray-600 */
            white-space: nowrap; /* whitespace-nowrap */
            overflow: hidden; /* overflow-hidden */
            text-overflow: ellipsis; /* text-ellipsis */
          }
        </style>
      </head>
      <body>
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
         <div class="webpage-card-content">
           <h3 class="webpage-card-title">${title}</h3>
           <p class="webpage-card-description">${description || new URL(url).hostname}</p>
         </div>
         ${imageUrl ? `<img src="${imageUrl}" alt="Page image" class="webpage-card-image">` : ''}
       </a>
      </body>
    </html>
  `;
}

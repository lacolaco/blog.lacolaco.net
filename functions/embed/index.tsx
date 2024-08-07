import { extractCss, setup, styled } from 'goober';
import { h } from 'preact';
import { render as renderPreact } from 'preact-render-to-string';
import { load } from 'cheerio';

setup(h);

declare global {
  interface CacheStorage {
    default: Cache; // https://developers.cloudflare.com/workers/runtime-apis/cache/#accessing-cache
  }
}
interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(decodeURIComponent(context.request.url)).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const cacheKey = context.request;
  const cache = caches.default;
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  const title = await getPageTitle(url);
  const html = buildEmbedHtml(title, url);
  const maxAge = 60 * 60 * 24; // 1 day
  const response = new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': `max-age=${maxAge}`,
    },
  });
  context.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
};

const amazonUrlPrefixes = ['https://www.amazon.co.jp/', 'https://amzn.asia/'];

async function getPageTitle(url: string) {
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
  if (metaOgTitle) {
    return metaOgTitle;
  }
  const metaTitle = $('head>meta[name="title"]').attr('content');
  if (metaTitle) {
    return metaTitle;
  }
  const docTitle = $('title').text();
  return docTitle || url;
}

function buildEmbedHtml(title: string, url: string) {
  const hostname = new URL(url).hostname;

  const App = styled('div')({
    border: '1px solid #ccc',
    borderRadius: '8px',
    overflow: 'hidden',
  });

  const Link = styled('a')({
    display: 'flex',
    alignItems: 'center',
    height: '120px',
    textDecoration: 'none',
    color: 'rgba(0, 0, 0, 0.82)',
    background: '#fff',
    '&:hover': {
      background: '#e3f6ffe0',
    },
  });

  const LinkContent = styled('div')({
    display: 'flex',
    flexDirection: 'column',
    rowGap: '0.25em',
    lineHeight: '1.5',
    padding: '0.8em 1.2em',
  });

  const LinkTitle = styled('h1')({
    margin: 0,
    fontSize: '1em',
    userSelect: 'none',
    wordBreak: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': 2,
    '-webkit-box-orient': 'vertical',
    maxHeight: '3.05em',
  });

  const LinkInfo = styled('div')({
    display: 'flex',
    alignItems: 'center',
    columnGap: '0.5em',
  });
  const LinkFavicon = styled('img')({});
  const LinkURL = styled('span')({
    fontSize: '0.8em',
    color: 'rgba(0, 0, 0, 0.6)',
    wordBreak: 'break-word',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    '-webkit-line-clamp': 1,
    '-webkit-box-orient': 'vertical',
  });

  const app = renderPreact(
    <App>
      <Link href={url} target="_blank" rel="noreferrer noopener nofollow">
        <LinkContent>
          <LinkTitle>{title}</LinkTitle>
          <LinkInfo>
            <LinkFavicon
              src={`https://www.google.com/s2/favicons?sz=14&domain_url=${url}`}
              alt={`${hostname} favicon image`}
              width="14"
              height="14"
            />
            <LinkURL>{url}</LinkURL>
          </LinkInfo>
        </LinkContent>
      </Link>
    </App>,
  );
  const style = extractCss();

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
          }
        </style>
        <style id="_goober">${style}</style>
      </head>
      <body>
        ${app}
      </body>
    </html>
  `;
}

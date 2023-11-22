import { extractCss, setup, styled } from 'goober';
import { h } from 'preact';
import { render as renderPreact } from 'preact-render-to-string';

setup(h);

interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(decodeURIComponent(context.request.url)).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }
  const title = await getPageTitle(url);
  const html = buildEmbedHtml(title, url);
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};

class DocumentTitleHandler {
  #chunks: string[] = [];
  get title() {
    return this.#chunks?.join('');
  }
  text(text: Text) {
    this.#chunks.push(text.text);
  }
}

class OgTitleHandler {
  title: string;
  element(element: Element) {
    this.title ??= element.getAttribute('content');
  }
}

async function getPageTitle(url: string) {
  const response = await fetch(url, {
    headers: {
      'user-agent': 'blog.lacolaco.net',
      accept: 'text/html',
      'accept-charset': 'utf-8',
    },
  });
  const docTitle = new DocumentTitleHandler();
  const ogTitle = new OgTitleHandler();
  const html = await response.text();
  await new HTMLRewriter()
    .on('head>title', docTitle)
    .on('meta[property="og:title"]', ogTitle)
    .transform(new Response(html))
    .text(); // wait for handlers to finish
  return ogTitle.title ?? docTitle.title ?? 'Untitled';
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
    '-webkit-line-clamp': 2,
    maxHeight: '3.05em',
    userSelect: 'none',
    wordBreak: 'break-word',
  });

  const LinkInfo = styled('div')({
    display: 'flex',
    alignItems: 'center',
    columnGap: '0.5em',
  });
  const LinkFavicon = styled('img')({});
  const LinkHostname = styled('span')({
    fontSize: '0.8em',
    color: 'rgba(0, 0, 0, 0.6)',
  });

  const app = renderPreact(
    <App>
      <Link href={url} target="_blank" rel="noreferrer noopener nofollow">
        <LinkContent>
          <LinkTitle>{title}</LinkTitle>
          <LinkInfo>
            <LinkFavicon
              src={`https://www.google.com/s2/favicons?sz=14&domain_url=${url}`}
              alt="doc.rust-jp.rs favicon image"
              width="14"
              height="14"
            />
            <LinkHostname>{hostname}</LinkHostname>
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

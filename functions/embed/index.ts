interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(decodeURIComponent(context.request.url)).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }
  const title = await getPageTitle(url);
  return new Response(`url is ${url}, title is ${title}`);
};

class DocumentTitleHandler {
  title: string;
  element(element: Element) {
    console.log(element.outerHTML);
  }
  text(text: Text) {
    console.log(JSON.stringify(text));
    this.title ??= text.text;
  }
}

class OgTitleHandler {
  title: string;
  element(element: Element) {
    console.log(element.outerHTML);
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
  console.log(html);
  new HTMLRewriter().on('title', docTitle).on('meta[property="og:title"]', ogTitle).transform(new Response(html));
  console.log(docTitle, ogTitle);
  return ogTitle.title ?? docTitle.title ?? 'Untitled';
}

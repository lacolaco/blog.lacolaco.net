interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }
  const title = await getPageTitle(url);
  return new Response(`url is ${url}, title is ${title}`);
};

class DocumentTitleHandler {
  title: string;
  element(element: HTMLTitleElement) {
    this.title ??= element.text;
  }
}

class OgTitleHandler {
  title: string;
  element(element: HTMLMetaElement) {
    this.title ??= element.getAttribute('content');
  }
}

async function getPageTitle(url: string) {
  const response = await fetch(url);
  const docTitle = new DocumentTitleHandler();
  const ogTitle = new OgTitleHandler();
  new HTMLRewriter().on('title', docTitle).on('meta[property="og:title"]', ogTitle).transform(response);
  return ogTitle.title ?? docTitle.title ?? 'Untitled';
}

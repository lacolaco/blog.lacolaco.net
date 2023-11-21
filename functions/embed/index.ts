interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }
  return new Response(`url is ${url}!`);
};

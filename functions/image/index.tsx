interface Env {}

export const onRequest: PagesFunction<Env> = async (context) => {
  const req = new URL(decodeURIComponent(context.request.url));
  const src = req.searchParams.get('src');
  const width = req.searchParams.get('w');
  const imageUrl = new URL(src, req.origin).toString();

  if (!src) {
    return new Response('Missing src parameter', { status: 400 });
  }

  // paththrough except production origin
  if (req.origin !== 'https://blog.lacolaco.net') {
    return fetch(imageUrl);
  }

  // use cf image transformation
  // https://developers.cloudflare.com/images/transform-images/transform-via-workers/
  try {
    return fetch(imageUrl, {
      cf: {
        image: {
          width: width ? parseInt(width) : 1024,
        },
      },
    });
  } catch (error) {
    // fallback to original image
    return fetch(imageUrl);
  }
};

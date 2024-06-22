interface Env {}

export const onRequest: PagesFunction<Env, 'path'> = async (context) => {
  console.log('Request', context.request.url);
  const req = new URL(decodeURIComponent(context.request.url));
  const src = req.searchParams.get('src');
  const width = req.searchParams.get('w');
  const imageUrl = new URL(src, req.origin).toString();

  // paththrough on localhost
  if (req.hostname === 'localhost') {
    return fetch(imageUrl);
  }

  // use cf image transformation
  // https://developers.cloudflare.com/images/transform-images/transform-via-workers/
  try {
    return fetch(imageUrl, {
      cf: {
        image: {
          width: width ? parseInt(width) : 1024,
          'origin-auth': 'share-publicly',
        },
      },
    });
  } catch (error) {
    // fallback to original image
    return fetch(imageUrl);
  }
};

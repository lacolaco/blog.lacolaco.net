function optimizeImageFormat(req: Request): RequestInitCfPropertiesImage['format'] {
  const accept = req.headers.get('accept');

  if (/image\/avif/.test(accept)) {
    return 'avif';
  } else if (/image\/webp/.test(accept)) {
    return 'webp';
  }
  return 'png';
}

export const onRequest: PagesFunction<{}> = async (context) => {
  const req = new URL(context.request.url);
  const src = decodeURIComponent(req.searchParams.get('src'));
  const width = req.searchParams.get('w');
  const imageUrl = new URL(src, req.origin).toString();

  if (!src) {
    return new Response('Missing src parameter', { status: 400 });
  }

  // paththrough except production origin
  if (req.origin !== 'https://blog.lacolaco.net') {
    return new Response(null, {
      status: 302,
      headers: { location: imageUrl },
    });
  }

  // use cf image transformation
  // https://developers.cloudflare.com/images/transform-images/transform-via-workers/
  try {
    return fetch(imageUrl, {
      cf: {
        image: {
          fit: 'scale-down',
          width: width ? parseInt(width) : 1024,
          format: optimizeImageFormat(context.request),
        },
      },
    });
  } catch (error) {
    // fallback to original image
    return new Response(null, {
      status: 302,
      headers: { location: imageUrl },
    });
  }
};

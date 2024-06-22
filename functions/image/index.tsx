function optimizeImageFormat(req: Request): RequestInitCfPropertiesImage['format'] {
  const accept = req.headers.get('accept');

  if (/image\/avif/.test(accept)) {
    return 'avif';
  } else if (/image\/webp/.test(accept)) {
    return 'webp';
  }
  return 'png';
}

export const onRequest: PagesFunction<{}> = async ({ request }) => {
  const reqUrl = new URL(request.url);
  const src = reqUrl.searchParams.get('src');
  const width = reqUrl.searchParams.get('w');

  if (!src) {
    return new Response('Missing src parameter', { status: 400 });
  }

  const imageUrl = new URL(src, reqUrl.origin).toString();
  console.log('imageUrl', imageUrl);

  // paththrough except production origin
  if (reqUrl.origin !== 'https://blog.lacolaco.net') {
    return new Response(null, {
      status: 302,
      headers: { location: imageUrl },
    });
  }

  // use cf image transformation
  // https://developers.cloudflare.com/images/transform-images/transform-via-workers/
  try {
    const imageReq = new Request(imageUrl, { headers: request.headers });
    return fetch(imageReq, {
      cf: {
        image: {
          fit: 'scale-down',
          width: width ? parseInt(width) : 1024,
          format: optimizeImageFormat(request),
        },
      },
    });
  } catch (error) {
    console.error(error);
    // fallback to original image
    return new Response(null, {
      status: 302,
      headers: { location: imageUrl },
    });
  }
};

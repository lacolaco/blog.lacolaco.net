import { SITE_TITLE } from '../../consts';
import { getIdToken } from './auth';

const siteDomainName = 'blog.lacolaco.net';

export async function generateOgImage(
  env: Env,
  ctx: ExecutionContext,
  params: { slug: string; title: string },
): Promise<ArrayBuffer> {
  const ogImageServiceUrl = env.OG_IMAGE_SERVICE_URL;
  const idToken = await getIdToken(env, ogImageServiceUrl, ctx);
  if (!idToken) {
    throw new Error('Failed to obtain ID token');
  }

  const resp = await fetch(ogImageServiceUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      title: params.title,
      slug: params.slug,
      siteTitle: SITE_TITLE,
      siteDomainName: siteDomainName,
    }),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(`Failed to fetch OG image: ${resp.status} ${resp.statusText} - ${message}`);
  }

  return await resp.arrayBuffer();
}

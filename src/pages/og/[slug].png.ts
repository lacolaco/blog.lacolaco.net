import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';

// export async function getStaticPaths() {
//   const posts = await queryAvailablePosts();

//   return posts.map((post) => ({
//     params: {
//       slug: post.data.slug,
//     },
//   }));
// }

export const prerender = false;

export async function GET({ params, locals }: APIContext) {
  const { slug } = params;
  if (!slug) return { status: 404 };

  const post = (await queryAvailablePosts()).find((post) => post.data.slug === slug);
  if (!post) return { status: 404 };

  const title = post.data.title;
  const ogImageServiceUrl = locals.runtime.env.OG_IMAGE_SERVICE_URL;

  try {
    const body = await getOgImage(ogImageServiceUrl, { slug, title });

    return new Response(body, {
      headers: {
        'content-type': 'image/png',
        // Cache for 1 hour and revalidate every hour
        'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    return new Response(`Failed to generate OG image: ${error}`, { status: 500 });
  }
}

const siteDomainName = 'blog.lacolaco.net';

export async function getOgImage(
  ogImageServiceUrl: string,
  params: { slug: string; title: string },
): Promise<ArrayBuffer> {
  const resp = await fetch(ogImageServiceUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
    },
    body: JSON.stringify({
      title: params.title,
      slug: params.slug,
      // siteTitle: SITE_TITLE,
      // siteDomainName: siteDomainName,
    }),
  });

  if (!resp.ok) {
    const message = await resp.text();
    throw new Error(`Failed to fetch OG image: ${resp.status} ${resp.statusText} - ${message}`);
  }

  return await resp.arrayBuffer();
}

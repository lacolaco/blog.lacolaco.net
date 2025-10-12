import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { generateOgImage } from '../../libs/og-image/generate';

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

  // Assert mandatory env vars
  const ogImageServiceUrl = locals.runtime.env.OG_IMAGE_SERVICE_URL;
  const serviceAccountKey = locals.runtime.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!ogImageServiceUrl) {
    return new Response('OG_IMAGE_SERVICE_URL is not set', { status: 500 });
  }
  if (!serviceAccountKey) {
    return new Response('GCP_SERVICE_ACCOUNT_KEY is not set', { status: 500 });
  }

  try {
    const title = post.data.title;
    const body = await generateOgImage(locals.runtime.env, locals.runtime.ctx, { slug, title });

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

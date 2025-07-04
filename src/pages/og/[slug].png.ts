import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { getOgImage } from '../../components/OgImage';

// export async function getStaticPaths() {
//   const posts = await queryAvailablePosts();

//   return posts.map((post) => ({
//     params: {
//       slug: post.data.slug,
//     },
//   }));
// }

export const prerender = false;

export async function GET({ params }: APIContext) {
  const { slug } = params;
  if (!slug) return { status: 404 };

  const post = (await queryAvailablePosts()).find((post) => post.data.slug === slug);
  if (!post) return { status: 404 };

  const title = post.data.title || 'No title';

  const body = await getOgImage(title);

  return new Response(body, {
    headers: {
      'content-type': 'image/png',
    },
  });
}

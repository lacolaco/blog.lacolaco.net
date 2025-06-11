import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getOgImage } from '../../components/OgImage';
import { queryAvailablePosts } from '@lib/query';

export async function getStaticPaths() {
  const posts = await queryAvailablePosts();

  return posts.map((post) => ({
    params: {
      slug: post.data.slug,
    },
  }));
}

export async function GET({ params }: APIContext) {
  const { slug } = params;
  if (!slug) return { status: 404 };

  const post = (await queryAvailablePosts()).find((post) => post.data.slug === slug);
  if (!post) return { status: 404 };

  const title = post.collection === 'postsV2' ? post.data.title : post.data.properties.title || 'No title';

  const body = await getOgImage(title);

  return new Response(body, {
    headers: {
      'content-type': 'image/png',
    },
  });
}

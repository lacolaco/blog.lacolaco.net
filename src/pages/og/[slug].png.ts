import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { getOgImage } from '../../components/OgImage';

export async function getStaticPaths() {
  const posts = await getCollection('post');

  return posts.map((post) => ({
    params: {
      slug: post.data.slug,
    },
  }));
}

export async function get({ params }: APIContext) {
  const { slug } = params;
  if (!slug) return { status: 404 };

  const post = (await getCollection('post')).find((post) => post.data.slug === slug);
  if (!post) return { status: 404 };

  const body = await getOgImage(post.data.properties.title ?? 'No title');

  return { body, encoding: 'binary' };
}

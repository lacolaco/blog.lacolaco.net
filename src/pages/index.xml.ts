import rss from '@astrojs/rss';
import { queryPosts } from '@lib/query';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context: APIContext) {
  const posts = await queryPosts();
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site?.toString() ?? '',
    items: posts.map((post) => ({
      title: post.properties.title,
      pubDate: post.properties.date,
      link: `/posts/${post.slug}`,
      categories: post.properties.tags,
    })),
  });
}

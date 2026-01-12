import rss from '@astrojs/rss';
import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { RSS_FULL_ITEMS_LIMIT, SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context: APIContext) {
  const allPosts = await queryAvailablePosts();
  const posts = allPosts.filter((post) => post.data.locale === 'en');

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site?.toString() ?? '',
    items: posts.slice(0, RSS_FULL_ITEMS_LIMIT).map((post) => {
      return {
        title: post.data.title,
        pubDate: post.data.created_time,
        link: `/posts/${post.data.slug}.en`,
        categories: post.data.tags,
        content: post.body,
      };
    }),
  });
}

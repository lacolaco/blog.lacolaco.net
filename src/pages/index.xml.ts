import rss from '@astrojs/rss';
import { queryAvailablePosts, deduplicatePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context: APIContext) {
  const allPosts = await queryAvailablePosts();
  const posts = deduplicatePosts(allPosts);

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site?.toString() ?? '',
    items: posts.map((post) => {
      return {
        title: post.data.title,
        pubDate: post.data.created_time,
        link: `/posts/${post.data.slug}`,
        categories: post.data.tags,
      };
    }),
  });
}

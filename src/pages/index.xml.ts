import rss from '@astrojs/rss';
import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function GET(context: APIContext) {
  const posts = await queryAvailablePosts();

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site?.toString() ?? '',
    items: posts.map((post) => {
      if (post.collection !== 'postsV2') {
        return {
          title: post.data.properties.title,
          pubDate: post.data.properties.date,
          link: `/posts/${post.data.slug}`,
          categories: post.data.properties.tags,
        };
      }
      return {
        title: post.data.title,
        pubDate: post.data.created_time,
        link: `/posts/${post.data.slug}`,
        categories: post.data.tags,
      };
    }),
  });
}

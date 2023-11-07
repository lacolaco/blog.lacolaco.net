import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { compareDesc } from 'date-fns';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function get(context: APIContext) {
  const posts = await getCollection('post');
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site?.toString() ?? '',
    items: posts
      .sort((a, b) => compareDesc(a.data.properties.date, b.data.properties.date))
      .map((post) => ({
        title: post.data.properties.title,
        pubDate: post.data.properties.date,
        link: `/posts/${post.data.slug}/`,
        categories: post.data.properties.tags,
      })),
  });
}

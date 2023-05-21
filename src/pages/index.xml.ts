import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';
import { format as formatDate } from 'date-fns';
import { SITE_DESCRIPTION, SITE_TITLE } from '../consts';

export async function get(context: APIContext) {
  const posts = await getCollection('blog');
  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: context.site?.toString() ?? '',
    items: posts
      .filter((post) => post.data.published)
      .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
      .map((post) => ({
        title: post.data.title,
        pubDate: post.data.date,
        link: `/${formatDate(post.data.date, 'yyyy/MM')}/${post.slug}/`,
        content: post.body,
        categories: post.data.tags,
      })),
  });
}

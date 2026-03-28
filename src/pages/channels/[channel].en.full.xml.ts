import type { CollectionEntry } from 'astro:content';
import rss from '@astrojs/rss';
import { queryAvailablePosts, queryChannels } from '@lib/query';
import type { APIContext } from 'astro';
import { RSS_FULL_ITEMS_LIMIT, SITE_DESCRIPTION, SITE_TITLE } from '../../consts';
import { urlize } from '../../libs/strings';

export async function getStaticPaths() {
  const allPosts = await queryAvailablePosts();
  const posts = allPosts.filter((post) => post.data.locale === 'en');
  const channels = queryChannels();

  return channels.map((channel) => {
    const matchPosts = posts.filter((post) => post.data.channels?.includes(channel.name));
    const urlizedName = urlize(channel.name);
    return {
      params: { channel: urlizedName },
      props: { channel: channel.name, posts: matchPosts },
    };
  });
}

type Props = {
  channel: string;
  posts: Array<CollectionEntry<'posts' | 'postsEn'>>;
};

export async function GET(context: APIContext<Props>) {
  const { channel, posts } = context.props;
  const articlesUrl = urlize(`${context.url.origin}/channels/${channel}`);
  return rss({
    title: `${channel} - ${SITE_TITLE}`,
    description: SITE_DESCRIPTION,
    site: articlesUrl,
    items: posts.slice(0, RSS_FULL_ITEMS_LIMIT).map((post) => {
      return {
        title: post.data.title,
        pubDate: post.data.created_time,
        link: `/posts/${post.data.slug}.en`,
        categories: post.data.tags,
        content: post.rendered?.html,
      };
    }),
  });
}

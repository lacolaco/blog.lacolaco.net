import rss from '@astrojs/rss';
import { type PostData } from '@lib/post';
import { queryAvailablePosts, queryTags } from '@lib/query';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';
import { urlize } from '../../libs/strings';
import type { CollectionEntry } from 'astro:content';

export async function getStaticPaths() {
  const posts = await queryAvailablePosts();
  const tags = await queryTags();

  return tags.map((tag) => {
    const matchPosts = posts.filter((post) => {
      return post.data.tags?.includes(tag.name);
    });
    const urlizedName = urlize(tag.name);
    return {
      params: { tag: urlizedName },
      props: { tag: tag.name, posts: matchPosts },
    };
  });
}

type Props = {
  tag: string;
  posts: Array<CollectionEntry<'postsV2'>>;
};

export async function GET(context: APIContext<Props>) {
  const { tag, posts } = context.props;
  const articlesUrl = urlize(`${context.url.origin}/tags/${tag}`);
  return rss({
    title: `Articles with #${tag} - ${SITE_TITLE}`,
    description: SITE_DESCRIPTION,
    site: articlesUrl,
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

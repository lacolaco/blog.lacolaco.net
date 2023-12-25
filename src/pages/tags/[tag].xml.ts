import rss from '@astrojs/rss';
import { PostData } from '@lib/post';
import { queryPosts, queryTags } from '@lib/query';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';
import { urlize } from '../../libs/strings';

export async function getStaticPaths() {
  const posts = await queryPosts();
  const tags = await queryTags();

  return tags.map((tag) => {
    const matchPosts = posts.filter((post) => (post.properties.tags ?? []).includes(tag.name));
    const urlizedName = urlize(tag.name);
    return {
      params: { tag: urlizedName },
      props: { tag: tag.name, posts: matchPosts },
    };
  });
}

type Props = {
  tag: string;
  posts: PostData[];
};

export async function GET(context: APIContext<Props>) {
  const { tag, posts } = context.props;
  const articlesUrl = urlize(`${context.url.origin}/tags/${tag}`);
  return rss({
    title: `Articles with #${tag} - ${SITE_TITLE}`,
    description: SITE_DESCRIPTION,
    site: articlesUrl,
    items: posts.map((post) => ({
      title: post.properties.title,
      pubDate: post.properties.date,
      link: `/posts/${post.slug}`,
      categories: post.properties.tags,
    })),
  });
}

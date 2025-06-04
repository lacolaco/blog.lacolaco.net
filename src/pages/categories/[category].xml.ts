import rss from '@astrojs/rss';
import { type PostData } from '@lib/post';
import { queryPosts, queryCategories } from '@lib/query';
import type { APIContext } from 'astro';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';
import { urlize } from '../../libs/strings';

export async function getStaticPaths() {
  const posts = await queryPosts();
  const categories = await queryCategories();

  return categories.map((category) => {
    const matchPosts = posts.filter((post) => post.properties.category === category.name);
    const urlizedName = urlize(category.name);
    return {
      params: { category: urlizedName },
      props: { category: category.name, posts: matchPosts },
    };
  });
}

type Props = {
  category: string;
  posts: PostData[];
};

export async function GET(context: APIContext<Props>) {
  const { category, posts } = context.props;
  const articlesUrl = urlize(`${context.url.origin}/categories/${category}`);
  return rss({
    title: `${category} Articles - ${SITE_TITLE}`,
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

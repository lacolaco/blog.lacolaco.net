import rss from '@astrojs/rss';
import { queryAvailablePosts, queryCategories } from '@lib/query';
import type { APIContext } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { SITE_DESCRIPTION, SITE_TITLE } from '../../consts';
import { urlize } from '../../libs/strings';

export async function getStaticPaths() {
  const posts = await queryAvailablePosts();
  const categories = await queryCategories();

  function hasCategory(categoryName: string, post: CollectionEntry<'post'> | CollectionEntry<'postsV2'>): boolean {
    return post.collection === 'postsV2'
      ? post.data.category === categoryName
      : post.data.properties.category === categoryName;
  }

  return categories.map((category) => {
    const matchPosts = posts.filter((post) => hasCategory(category.name, post));
    const urlizedName = urlize(category.name);
    return {
      params: { category: urlizedName },
      props: { category: category.name, posts: matchPosts },
    };
  });
}

type Props = {
  category: string;
  posts: Array<CollectionEntry<'post'> | CollectionEntry<'postsV2'>>;
};

export async function GET(context: APIContext<Props>) {
  const { category, posts } = context.props;
  const articlesUrl = urlize(`${context.url.origin}/categories/${category}`);
  return rss({
    title: `${category} Articles - ${SITE_TITLE}`,
    description: SITE_DESCRIPTION,
    site: articlesUrl,
    items: posts.map((post) => {
      if (post.collection === 'postsV2') {
        return {
          title: post.data.title,
          pubDate: post.data.created_time,
          link: `/posts/${post.data.slug}`,
          categories: post.data.tags,
        };
      }
      return {
        title: post.data.properties.title,
        pubDate: post.data.properties.date,
        link: `/posts/${post.data.slug}`,
        categories: post.data.properties.tags,
      };
    }),
  });
}

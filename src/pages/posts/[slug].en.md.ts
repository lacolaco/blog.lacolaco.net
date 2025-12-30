import type { APIContext } from 'astro';
import type { CollectionEntry } from 'astro:content';
import { queryAvailablePosts } from '@lib/query';
import { readRawMarkdown } from '@lib/markdown';

export async function getStaticPaths() {
  const posts = await queryAvailablePosts();

  return posts
    .filter((post) => post.data.locale === 'en') // 英語記事のみ
    .map((post) => ({
      params: {
        slug: post.data.slug,
      },
      props: {
        entry: post,
      },
    }));
}

type Props = {
  entry: CollectionEntry<'posts'>;
};

export function GET({ props }: APIContext<Props>) {
  const { entry } = props;

  try {
    const markdown = readRawMarkdown(entry);

    return new Response(markdown, {
      headers: {
        'content-type': 'text/markdown; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    console.error(`Failed to read markdown for slug: ${entry.data.slug}`, error);
    return new Response('Not Found', { status: 404 });
  }
}

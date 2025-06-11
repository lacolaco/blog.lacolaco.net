import { getCollection, type CollectionEntry } from 'astro:content';
import { compareDesc, isPast } from 'date-fns';

export async function queryAvailablePosts(): Promise<Array<CollectionEntry<'post'> | CollectionEntry<'postsV2'>>> {
  const posts = await getCollection('post');
  const postsV2 = await getCollection('postsV2');
  const availablePosts = [
    ...postsV2
      .filter((entry) => {
        // import.meta.env.MODE が 'production' の場合、公開済みの投稿のみを対象とする
        if (import.meta.env.MODE === 'production') {
          return entry.data.published && isPast(entry.data.created_time);
        }
        // 開発モードでは全ての投稿を対象とする
        return true;
      })
      .sort((a, b) => compareDesc(a.data.created_time, b.data.created_time)),
    ...posts
      .filter((entry) => {
        if (postsV2.some((p) => p.data.slug === entry.data.slug)) {
          // postsV2 に存在しない投稿のみを対象とする
          return false;
        }
        // import.meta.env.MODE が 'production' の場合、公開済みの投稿のみを対象とする
        if (import.meta.env.MODE === 'production') {
          return isPast(entry.data.properties.date);
        }
        // 開発モードでは全ての投稿を対象とする
        return true;
      })
      .sort((a, b) => compareDesc(a.data.properties.date, b.data.properties.date)),
  ];
  return availablePosts;
}

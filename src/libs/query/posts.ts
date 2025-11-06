import { getCollection, type CollectionEntry } from 'astro:content';
import { compareAsc, compareDesc, isPast } from 'date-fns';

export async function queryAvailablePosts(): Promise<Array<CollectionEntry<'postsV2'>>> {
  const postsV2 = await getCollection('postsV2');
  const availablePosts = postsV2
    .filter((entry) => {
      // import.meta.env.MODE が 'production' の場合、公開済みの投稿のみを対象とする
      if (import.meta.env.MODE === 'production') {
        return entry.data.published && isPast(entry.data.created_time);
      }
      // 開発モードでは全ての投稿を対象とする
      return true;
    })
    .sort((a, b) => compareDesc(a.data.created_time, b.data.created_time));
  return availablePosts;
}

/**
 * 指定されたカテゴリ内で、現在の記事の前後の記事を返す
 * @param currentPost 現在の記事
 * @param category カテゴリ名
 * @param allPosts 全記事のリスト（省略時は queryAvailablePosts() を使用）
 * @returns 前の記事と次の記事
 */
export async function queryAdjacentPostsInCategory(
  currentPost: CollectionEntry<'postsV2'>,
  category: string,
  allPosts?: Array<CollectionEntry<'postsV2'>>,
): Promise<{
  previousPost: CollectionEntry<'postsV2'> | undefined;
  nextPost: CollectionEntry<'postsV2'> | undefined;
}> {
  const posts = allPosts ?? (await queryAvailablePosts());
  const currentLocale = currentPost.data.locale ?? 'ja';

  // 同じカテゴリ、同じロケールの記事を古い順にソート
  const categoryPosts = posts
    .filter((post) => {
      const postLocale = post.data.locale ?? 'ja';
      return post.data.category === category && postLocale === currentLocale;
    })
    .sort((a, b) => compareAsc(a.data.created_time, b.data.created_time));

  // 現在の記事のインデックスを取得
  const currentIndex = categoryPosts.findIndex((post) => post.data.slug === currentPost.data.slug);

  if (currentIndex === -1) {
    return { previousPost: undefined, nextPost: undefined };
  }

  return {
    previousPost: currentIndex > 0 ? categoryPosts[currentIndex - 1] : undefined,
    nextPost: currentIndex < categoryPosts.length - 1 ? categoryPosts[currentIndex + 1] : undefined,
  };
}

import { getCollection, type CollectionEntry } from 'astro:content';
import { compareDesc, compareAsc, isPast } from 'date-fns';

export async function queryAvailablePosts(): Promise<Array<CollectionEntry<'posts' | 'postsEn'>>> {
  const posts = await getCollection('posts');
  const postsEn = await getCollection('postsEn');
  const allPosts = [...posts, ...postsEn];

  const availablePosts = allPosts
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
 * 重複する記事を除外する
 * 同じslugを持つ記事が複数ある場合、日本語版（locale: 'ja'）を優先し、英語版を除外する
 */
export function deduplicatePosts(
  posts: Array<CollectionEntry<'posts' | 'postsEn'>>,
): Array<CollectionEntry<'posts' | 'postsEn'>> {
  const seen = new Set<string>();
  const deduplicatedPosts: Array<CollectionEntry<'posts' | 'postsEn'>> = [];

  for (const post of posts) {
    const slug = post.data.slug;
    if (seen.has(slug)) {
      continue;
    }
    seen.add(slug);

    // 同じslugの日本語版を優先して探す
    const jaPost = posts.find((p) => p.data.slug === slug && p.data.locale === 'ja');
    deduplicatedPosts.push(jaPost ?? post);
  }

  return deduplicatedPosts;
}

/**
 * 時系列順に前後の記事を取得する
 * カテゴリやロケールは区別しない
 */
export function queryAdjacentPosts(
  posts: Array<CollectionEntry<'posts'>>,
  currentSlug: string,
): { prev: CollectionEntry<'posts'> | null; next: CollectionEntry<'posts'> | null } {
  // 時系列順（古い順）にソート
  const sortedPosts = [...posts].sort((a, b) => compareAsc(a.data.created_time, b.data.created_time));

  // 現在の記事のインデックスを取得
  const currentIndex = sortedPosts.findIndex((post) => post.data.slug === currentSlug);

  if (currentIndex === -1) {
    return { prev: null, next: null };
  }

  // 前の記事（より古い記事）と次の記事（より新しい記事）を返す
  return {
    prev: currentIndex > 0 ? sortedPosts[currentIndex - 1] : null,
    next: currentIndex < sortedPosts.length - 1 ? sortedPosts[currentIndex + 1] : null,
  };
}

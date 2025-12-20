import { getCollection, type CollectionEntry } from 'astro:content';
import { compareDesc, compareAsc, isPast } from 'date-fns';

export async function queryAvailablePosts(): Promise<Array<CollectionEntry<'postsV2' | 'postsV2En'>>> {
  const postsV2 = await getCollection('postsV2');
  const postsV2En = await getCollection('postsV2En');
  const allPosts = [...postsV2, ...postsV2En];

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
  posts: Array<CollectionEntry<'postsV2' | 'postsV2En'>>,
): Array<CollectionEntry<'postsV2' | 'postsV2En'>> {
  // slugごとに記事をグループ化
  const postsBySlug = new Map<string, Array<CollectionEntry<'postsV2' | 'postsV2En'>>>();

  for (const post of posts) {
    const slug = post.data.slug;
    if (!postsBySlug.has(slug)) {
      postsBySlug.set(slug, []);
    }
    postsBySlug.get(slug)!.push(post);
  }

  // 各slugグループから日本語版を優先的に選択
  const deduplicatedPosts: Array<CollectionEntry<'postsV2' | 'postsV2En'>> = [];

  for (const postsGroup of postsBySlug.values()) {
    // 日本語版があればそれを使用、なければ最初の記事を使用
    const jaPost = postsGroup.find((post) => post.data.locale === 'ja');
    deduplicatedPosts.push(jaPost ?? postsGroup[0]);
  }

  return deduplicatedPosts;
}

/**
 * 時系列順に前後の記事を取得する
 * カテゴリやロケールは区別しない
 */
export function queryAdjacentPosts(
  posts: Array<CollectionEntry<'postsV2'>>,
  currentSlug: string,
): { prev: CollectionEntry<'postsV2'> | null; next: CollectionEntry<'postsV2'> | null } {
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

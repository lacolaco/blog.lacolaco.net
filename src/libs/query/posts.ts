import { getCollection, type CollectionEntry } from 'astro:content';
import { compareDesc, compareAsc, isPast } from 'date-fns';
import { getRelativePostUrl } from '../compat';

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
 * Translated List Display 用に各 post に翻訳 metadata を attach する。
 * 詳細は docs/design/bilingual-list-display.md (Option D) を参照。
 *
 * 入力: dedup 済み posts (ja-preferred) と en posts 全集合
 * 出力: 各 entry に translations.en を持たせた配列。en 記事自体には translations を入れない
 *       (canonical entry が en になっているケースは swap 対象外)
 */
export interface PostTranslations {
  en?: { title: string; href: string };
}

export interface PostWithTranslations {
  post: CollectionEntry<'posts' | 'postsEn'>;
  translations: PostTranslations;
}

export function attachTranslations(
  posts: Array<CollectionEntry<'posts' | 'postsEn'>>,
  enPosts: Array<CollectionEntry<'postsEn'>>,
): PostWithTranslations[] {
  // slug → en post の Map を事前構築して posts.map 内 lookup を O(1) にする
  const enBySlug = new Map(enPosts.map((p) => [p.data.slug, p]));
  return posts.map((post) => {
    const translations: PostTranslations = {};
    if (post.data.locale !== 'en') {
      const enPost = enBySlug.get(post.data.slug);
      if (enPost) {
        translations.en = {
          title: enPost.data.title,
          href: getRelativePostUrl(enPost),
        };
      }
    }
    return { post, translations };
  });
}

/**
 * List page で表示する posts に dedup と翻訳 metadata を attach した形を返す helper。
 * 各 list page (index, channels, tags) で共通利用する
 */
export async function queryListPagePosts(): Promise<PostWithTranslations[]> {
  const allPosts = await queryAvailablePosts();
  const enPosts = allPosts.filter((p): p is CollectionEntry<'postsEn'> => p.data.locale === 'en');
  const deduped = deduplicatePosts(allPosts);
  return attachTranslations(deduped, enPosts);
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

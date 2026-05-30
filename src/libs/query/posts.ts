import { getCollection, type CollectionEntry } from 'astro:content';
import { compareDesc, compareAsc, isPast } from 'date-fns';
import { getRelativePostUrl } from '../compat';

export async function queryAvailablePosts(): Promise<Array<CollectionEntry<'posts' | 'postsEn'>>> {
  const posts = await getCollection('posts');
  const postsEn = await getCollection('postsEn');
  const allPosts = [...posts, ...postsEn];

  // 公開済み (published && 過去日) の集合だけが URL を生成する。
  // slug 衝突 fail-loud はこの集合に対してのみ掛ける。
  // draft (published: false) / 未来日記は URL を生成しないため衝突しても build を落とさない
  // — そうでないと content/posts/ を「Notion 昇格前の下書き置き場」として使えなくなる。
  // この不変は production / dev 共通: dev でも draft slug は既存 Notion 記事と衝突可能だが
  // dev サーバを落とす理由は無い (preview したいから走らせている)。
  const publishedPosts = allPosts.filter((entry) => entry.data.published && isPast(entry.data.created_time));
  assertUniqueSlugs(publishedPosts);

  // production では publish 集合のみを返し、dev では draft を含む全件を返す。
  const availablePosts = import.meta.env.MODE === 'production' ? publishedPosts : allPosts;
  return availablePosts.sort((a, b) => compareDesc(a.data.created_time, b.data.created_time));
}

/**
 * (locale, slug) ペアの重複を検知して throw する。
 *
 * 同じ locale で slug が重複していると同じ URL を生成するページが 2 つ存在することになり、
 * 動的ルートで競合する。ja と en で同 slug を持つのは i18n pair として正常なので許可。
 *
 * notion/posts 配下と posts 直下を 1 collection に束ねる設計のため、出自を跨いだ slug 衝突を
 * build 時に fail-loud で検知することが目的。
 *
 * locale の判定は frontmatter ではなく collection (postsEn=en, posts=ja) を権威とする。
 * frontmatter.locale は optional で書き忘れ・誤記がありうるが、filename↔collection の対応は
 * Astro の glob loader が型レベルで保証するため、こちらを source of truth に取る。
 */
export function assertUniqueSlugs(entries: Array<CollectionEntry<'posts' | 'postsEn'>>): void {
  const seen = new Map<string, CollectionEntry<'posts' | 'postsEn'>>();
  for (const entry of entries) {
    const locale = entry.collection === 'postsEn' ? 'en' : 'ja';
    const key = `${locale}:${entry.data.slug}`;
    const existing = seen.get(key);
    if (existing) {
      throw new Error(
        `Duplicate post slug "${entry.data.slug}" in locale "${locale}":\n` +
          `  - ${existing.id}\n` +
          `  - ${entry.id}\n` +
          `URL は frontmatter.slug 由来のため、同 locale 内では一意である必要があります。`,
      );
    }
    seen.set(key, entry);
  }
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
 * List page で表示する posts を所与の集合から組み立てる pure 関数。
 * IO を分離して unit test できるようにする (queryListPagePosts は thin wrapper)
 */
export function buildListPagePosts(allPosts: Array<CollectionEntry<'posts' | 'postsEn'>>): PostWithTranslations[] {
  const enPosts = allPosts.filter((p): p is CollectionEntry<'postsEn'> => p.data.locale === 'en');
  const deduped = deduplicatePosts(allPosts);
  return attachTranslations(deduped, enPosts);
}

/**
 * List page で表示する posts に dedup と翻訳 metadata を attach した形を返す helper。
 * 各 list page (index, channels, tags) で共通利用する
 */
export async function queryListPagePosts(): Promise<PostWithTranslations[]> {
  const allPosts = await queryAvailablePosts();
  return buildListPagePosts(allPosts);
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

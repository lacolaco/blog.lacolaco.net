import { PostFrontmatter } from './libs/post/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

// content/ 配下を 2 系統 (notion/posts = sync 出力、posts = 直接執筆) で 1 collection に束ねる。
// id は 'notion/posts/<file>' / 'posts/<file>' で別物になるため Astro 側の id 衝突は起きないが、
// URL は frontmatter.slug 由来のため slug 重複は queryAvailablePosts で実行時にガードする。
//
// 再帰性は系統ごとに非対称: notion/posts は blog-contents sync が flat (`path.join(postsDir, filename)`)
// で書くため非再帰、posts は直接執筆者がサブディレクトリ整理する自由度を残すため再帰。
// `notion/posts/**` にすると tools/auto-translate/main.ts:listJaFiles (非再帰) との silent な
// 不整合が生じる (将来 notion/posts 配下に dir が現れたら content layer は拾い auto-translate はスキップ)。
const posts = defineCollection({
  loader: glob({
    pattern: ['notion/posts/*.md', 'posts/**/*.md', '!**/*.en.md'],
    base: 'content',
  }),
  // posts collection に入る = filename が `.en.md` ではない = locale は ja で固定。
  // postsEn 側と対称に transform で frontmatter.locale を ja に上書きし、
  // downstream の `data.locale === 'en'` / `!== 'en'` 分岐 (route filter / RSS / sitemap /
  // getRelativePostUrl / [slug].astro / [slug].en.astro) で collection を source of truth にする。
  // 「locale の唯一の出所は collection」という不変を ja/en 両方向で成立させる。
  schema: PostFrontmatter.transform((data) => ({ ...data, locale: 'ja' as const })),
});

const postsEn = defineCollection({
  loader: glob({
    pattern: ['notion/posts/*.en.md', 'posts/**/*.en.md'],
    base: 'content',
  }),
  // postsEn collection に入る = filename が .en.md = locale は en で固定。
  // frontmatter.locale を書き忘れたり別値を書いても en に強制し、
  // downstream の `data.locale === 'en'` 分岐 (route filter / dedup / translation) を堅牢にする。
  schema: PostFrontmatter.transform((data) => ({ ...data, locale: 'en' as const })),
});

export const collections = { posts, postsEn };

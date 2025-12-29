import { PostFrontmatter } from './libs/post/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({
    pattern: ['**/*.md', '!**/*.en.md'], // .en.md を除外して日本語記事のみ
    base: 'src/content/post',
  }),
  schema: PostFrontmatter,
});

const postsEn = defineCollection({
  loader: glob({
    pattern: '**/*.en.md', // 英語記事のみ
    base: 'src/content/post',
  }),
  schema: PostFrontmatter,
});

export const collections = { posts, postsEn };

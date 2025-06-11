import { PostFrontmatter } from './libs/post/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const postsV2 = defineCollection({
  loader: glob({ pattern: '**/*.md', base: 'src/content/post' }),
  schema: PostFrontmatter,
});

export const collections = { postsV2 };

import { PostFrontmatter, postSchema } from './libs/post/schema';
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const post = defineCollection({
  loader: glob({ pattern: '**/*.json', base: 'src/content/post' }),
  schema: postSchema,
});

const postsV2 = defineCollection({
  loader: glob({ pattern: 'src/content/post/**/*.md' }),
  schema: PostFrontmatter,
});

export const collections = { post, postsV2 };

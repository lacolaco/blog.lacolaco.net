import { postSchema } from './libs/post/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

const post = defineCollection({
  loader: glob({ pattern: '**/*.json', base: 'src/content/post' }),
  schema: postSchema,
});

export const collections = { post };

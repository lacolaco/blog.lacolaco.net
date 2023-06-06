import { postSchema } from '../libs/post/schema';
import { defineCollection } from 'astro:content';

const post = defineCollection({
  type: 'data',
  schema: postSchema,
});

export const collections = { post };

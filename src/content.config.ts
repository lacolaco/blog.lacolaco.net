import { postSchema } from './libs/post/schema';
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const post = defineCollection({
  loader: glob({ pattern: '**/*.json', base: 'src/content/post' }),
  schema: postSchema,
});

const kitchenSink = defineCollection({
  loader: glob({ pattern: 'src/content/kitchen-sink.md' }),

  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { post, kitchenSink };

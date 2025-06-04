import { postSchema } from './libs/post/schema';
import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

const post = defineCollection({
  loader: glob({ pattern: '**/*.json', base: 'src/content/post' }),
  schema: postSchema,
});

const kitchenSink = defineCollection({
  loader: file('./content/kitchen-sink.md'),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { post, kitchenSink };

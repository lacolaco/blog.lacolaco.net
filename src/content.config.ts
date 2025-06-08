import { postSchema } from './libs/post/schema';
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const post = defineCollection({
  loader: glob({ pattern: '**/*.json', base: 'src/content/post' }),
  schema: postSchema,
});

const postsV2 = defineCollection({
  loader: glob({ pattern: 'src/content/post/**/*.md' }),

  schema: z
    .object({
      title: z.string(),
      published: z.boolean(),
      category: z.string(),
      tags: z.array(z.string()),
      created_time: z.string().transform((val) => new Date(val)),
      last_edited_time: z.string().transform((val) => new Date(val)),
      slug: z.string(),
      locale: z.string().optional(),
      canonical_url: z.string().optional(),
    })
    .passthrough(),
});

export const collections = { post, postsV2 };

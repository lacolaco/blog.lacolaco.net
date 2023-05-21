import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  // Type-check frontmatter using a schema
  schema: z.object({
    title: z.string(),
    date: z
      .string()
      .or(z.date())
      .transform((val) => new Date(val)),
    updatedAt: z
      .string()
      .or(z.date())
      .optional()
      .transform((val) => (val ? new Date(val) : undefined)),
    tags: z.array(z.string()).optional(),
    published: z.boolean(),
    emoji: z.string().optional(),
    source: z.string().optional(),
    canonicalUrl: z.string().optional(),
  }),
});

export const collections = { blog };

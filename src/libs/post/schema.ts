import { z } from 'zod';

export const Locale = z.enum(['ja', 'en']);
export type Locale = z.infer<typeof Locale>;

export const Tag = z.object({
  name: z.string(),
  color: z.string(),
});

export type Tag = z.infer<typeof Tag>;

export const Tags = z.record(Tag);
export type Tags = z.infer<typeof Tags>;

export const Category = z.object({
  name: z.string(),
  color: z.string(),
});
export type Category = z.infer<typeof Category>;

export const Categories = z.record(Category);
export type Categories = z.infer<typeof Categories>;

export const PostFrontmatter = z
  .object({
    title: z.string(),
    slug: z.string(),
    icon: z.string().optional(),
    created_time: z.string().transform((val) => new Date(val)),
    last_edited_time: z.string().transform((val) => new Date(val)),
    category: z.string(),
    tags: z.array(z.string()),
    published: z.boolean(),
    locale: z.string().optional(),
    canonical_url: z.string().optional(),
    notion_url: z.string().optional(),
    features: z
      .object({
        tweet: z.boolean().default(false),
        mermaid: z.boolean().default(false),
        katex: z.boolean().default(false),
      })
      .optional(),
  })
  .passthrough();

export type PostFrontmatterIn = z.input<typeof PostFrontmatter>;
export type PostFrontmatterOut = z.output<typeof PostFrontmatter>;

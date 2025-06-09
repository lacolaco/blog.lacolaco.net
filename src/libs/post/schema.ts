import { z } from 'zod';
import { type ContentNode } from './nodes';

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

export const postSchema = z.object({
  pageId: z.string(),
  lastEditedAt: z.string(),
  slug: z.string(),
  locale: Locale.optional().transform((val) => val ?? 'ja'),
  properties: z
    .object({
      title: z.string(),
      date: z
        .string()
        .or(z.date())
        .transform((val) => new Date(val)),
      category: z.string().optional(),
      tags: z.array(z.string()),
      updatedAt: z
        .string()
        .or(z.date())
        .optional()
        .transform((val) => (val ? new Date(val) : undefined)),
      canonicalUrl: z.string().optional(),
    })
    .passthrough(),
  content: z
    .array(
      z
        .object({
          type: z.string(),
        })
        .passthrough(),
    )
    .transform((val) => val as ContentNode[]),
});

export type PostData = z.infer<typeof postSchema>;

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

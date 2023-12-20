import { z } from 'zod';
import { ContentNode } from './nodes';
import { Locale } from './i18n';

export const TagType = z.object({
  name: z.string(),
  color: z.string(),
});

export type TagType = z.infer<typeof TagType>;

export const Tags = z.record(TagType);
export type Tags = z.infer<typeof Tags>;

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

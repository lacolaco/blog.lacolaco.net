import { z } from 'zod';
import { ContentNode } from './nodes';

export const postSchema = z.object({
  pageId: z.string(),
  lastEditedAt: z.string(),
  slug: z.string(),
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

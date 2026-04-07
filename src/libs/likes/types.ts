import { z } from 'astro/zod';

/** いいね状態のレスポンス */
export const LikeStatus = z.object({
  count: z.number(),
  liked: z.boolean(),
});
export type LikeStatus = z.infer<typeof LikeStatus>;

/**
 * slugスキーマ。
 * 英小文字・数字・ドット・ハイフン・アンダースコアで構成、最大200文字。
 */
export const Slug = z
  .string()
  .regex(/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/)
  .max(200)
  .brand('Slug');
export type Slug = z.infer<typeof Slug>;

/**
 * clientIdスキーマ。
 * Firestoreフィールドパスとして安全な文字種（hex + ハイフン）、最大128文字。
 * 生成はcrypto.randomUUID()だが、バリデーションの目的は形式の安全性であり
 * UUID v4構造の検証ではない。
 */
export const ClientId = z
  .string()
  .min(1)
  .regex(/^[0-9a-f-]+$/i)
  .max(128)
  .brand('ClientId');
export type ClientId = z.infer<typeof ClientId>;

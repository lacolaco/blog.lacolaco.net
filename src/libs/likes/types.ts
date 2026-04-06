/**
 * いいね（スキ）機能の型定義
 */

import type { Timestamp } from '@google-cloud/firestore';

/** Firestoreドキュメント: post_likes/{slug} */
export interface PostLikeDoc {
  count: number;
  updated_at: Timestamp;
}

/** Firestoreドキュメント: post_likes/{slug}/reactions/{clientId} */
export interface ReactionDoc {
  created_at: Timestamp;
}

/** APIレスポンス */
export interface LikeResponse {
  count: number;
  liked: boolean;
}

/** UUID v4 正規表現（クライアント・サーバー共通） */
export const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

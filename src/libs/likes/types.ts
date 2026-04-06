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

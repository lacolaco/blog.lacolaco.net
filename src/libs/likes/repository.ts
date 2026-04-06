/**
 * いいね（スキ）Firestoreリポジトリ
 * トランザクションベースのカウント管理・重複防止
 */

import { getFieldValue, getFirestore } from './firestore';
import type { LikeResponse, PostLikeDoc } from './types';
import { UUID_V4_REGEX } from './types';

const COLLECTION = 'post_likes';
const SUB_COLLECTION = 'reactions';

/**
 * スキ状態を取得する
 * @param slug 記事スラグ
 * @param clientId クライアントID（空文字の場合 liked: false）
 */
export async function getLikeStatus(slug: string, clientId: string): Promise<LikeResponse> {
  if (clientId && !UUID_V4_REGEX.test(clientId)) {
    throw new Error('Invalid clientId format');
  }
  const db = await getFirestore();
  const postRef = db.collection(COLLECTION).doc(slug);

  const [postSnap, reactionSnap] = await Promise.all([
    postRef.get(),
    clientId ? postRef.collection(SUB_COLLECTION).doc(clientId).get() : Promise.resolve(null),
  ]);

  const count = postSnap.exists ? ((postSnap.data() as PostLikeDoc).count ?? 0) : 0;
  return { count, liked: reactionSnap?.exists ?? false };
}

/**
 * スキをトグルする（トランザクション）
 * reaction存在 → 削除 + count-1
 * reaction未存在 → 作成 + count+1
 */
export async function toggleLike(slug: string, clientId: string): Promise<LikeResponse> {
  if (!clientId || !UUID_V4_REGEX.test(clientId)) {
    throw new Error('Valid clientId is required');
  }
  const [FieldValue, db] = await Promise.all([getFieldValue(), getFirestore()]);
  const postRef = db.collection(COLLECTION).doc(slug);
  const reactionRef = postRef.collection(SUB_COLLECTION).doc(clientId);

  return db.runTransaction(async (tx) => {
    const [postSnap, reactionSnap] = await Promise.all([tx.get(postRef), tx.get(reactionRef)]);

    const currentCount = postSnap.exists ? ((postSnap.data() as PostLikeDoc).count ?? 0) : 0;

    if (reactionSnap.exists) {
      // スキ取り消し
      tx.delete(reactionRef);
      const newCount = Math.max(0, currentCount - 1);
      tx.set(postRef, { count: newCount, updated_at: FieldValue.serverTimestamp() }, { merge: true });
      return { count: newCount, liked: false };
    } else {
      // スキ追加
      tx.set(reactionRef, { created_at: FieldValue.serverTimestamp() });
      const newCount = currentCount + 1;
      tx.set(postRef, { count: newCount, updated_at: FieldValue.serverTimestamp() }, { merge: true });
      return { count: newCount, liked: true };
    }
  });
}

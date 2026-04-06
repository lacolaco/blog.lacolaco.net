import { getFirestore } from './firestore';
import { RATE_LIMIT_MS, type LikeResult } from './types';

const COLLECTION = 'post_likes';
const REACTIONS_SUBCOLLECTION = 'reactions';

/**
 * 記事のスキ状態を取得する
 */
export async function getLikeStatus(slug: string, clientId?: string): Promise<LikeResult> {
  const db = getFirestore();
  const postRef = db.collection(COLLECTION).doc(slug);
  const postSnap = await postRef.get();

  const count = postSnap.exists ? ((postSnap.data()?.count as number) ?? 0) : 0;

  if (!clientId) {
    return { count, liked: false };
  }

  const reactionSnap = await postRef.collection(REACTIONS_SUBCOLLECTION).doc(clientId).get();
  return { count, liked: reactionSnap.exists };
}

/**
 * スキをトグルする（Firestoreトランザクション内で実行）
 */
export async function toggleLike(slug: string, clientId: string): Promise<LikeResult> {
  const db = getFirestore();
  const postRef = db.collection(COLLECTION).doc(slug);
  const reactionRef = postRef.collection(REACTIONS_SUBCOLLECTION).doc(clientId);

  return db.runTransaction(async (transaction) => {
    const postSnap = await transaction.get(postRef);
    const reactionSnap = await transaction.get(reactionRef);

    const currentCount = postSnap.exists ? ((postSnap.data()?.count as number) ?? 0) : 0;
    const isLiked = reactionSnap.exists;

    if (isLiked) {
      // レート制限チェック
      const createdAt = reactionSnap.data()?.created_at as Date | undefined;
      if (createdAt) {
        const elapsed = Date.now() - createdAt.getTime();
        if (elapsed < RATE_LIMIT_MS) {
          throw new Error('RATE_LIMITED');
        }
      }

      // 取り消し
      transaction.delete(reactionRef);
      const newCount = Math.max(0, currentCount - 1);
      if (postSnap.exists) {
        transaction.update(postRef, { count: newCount, updated_at: new Date() });
      }
      return { count: newCount, liked: false };
    } else {
      // スキ
      transaction.set(reactionRef, { created_at: new Date() });
      const newCount = currentCount + 1;
      if (postSnap.exists) {
        transaction.update(postRef, { count: newCount, updated_at: new Date() });
      } else {
        transaction.set(postRef, { count: newCount, updated_at: new Date() });
      }
      return { count: newCount, liked: true };
    }
  });
}

export type { LikeResult } from './types';

/**
 * Firestore クライアント初期化（シングルトン）
 * ADC認証: Cloud Run / ローカル compose.yml 両対応
 * 動的importでdev mode時のSSRモジュール読み込みエラーを回避
 */

import type { Firestore } from '@google-cloud/firestore';

let _db: Firestore | null = null;

export async function getFirestore(): Promise<Firestore> {
  if (!_db) {
    const { Firestore: FirestoreClass } = await import('@google-cloud/firestore');
    _db = new FirestoreClass({
      projectId: process.env.GCP_PROJECT_ID || 'blog-lacolaco-net',
    });
  }
  return _db;
}

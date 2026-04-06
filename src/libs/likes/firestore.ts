/**
 * Firestore クライアント初期化（シングルトン）
 * ADC認証: Cloud Run / ローカル compose.yml 両対応
 * 動的importでdev mode時のSSRモジュール読み込みエラーを回避
 */

import type { Firestore, FieldValue as FieldValueType } from '@google-cloud/firestore';

let _db: Firestore | null = null;
let _FieldValue: typeof FieldValueType | null = null;

export async function getFirestore(): Promise<Firestore> {
  if (!_db) {
    const mod = await import('@google-cloud/firestore');
    _db = new mod.Firestore({
      projectId: process.env.GCP_PROJECT_ID || 'blog-lacolaco-net',
    });
    _FieldValue = mod.FieldValue;
  }
  return _db;
}

export async function getFieldValue(): Promise<typeof FieldValueType> {
  if (!_FieldValue) {
    await getFirestore();
  }
  return _FieldValue!;
}

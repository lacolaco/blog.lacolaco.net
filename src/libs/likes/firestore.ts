/**
 * Firestore クライアント初期化（シングルトン）
 * ADC認証: Cloud Run / ローカル compose.yml 両対応
 * 動的importでdev mode時のSSRモジュール読み込みエラーを回避
 */

import type { Firestore, FieldValue as FieldValueType } from '@google-cloud/firestore';

let _db: Firestore | null = null;
let _FieldValue: typeof FieldValueType | null = null;
let _initPromise: Promise<void> | null = null;

async function initialize(): Promise<void> {
  try {
    const mod = await import('@google-cloud/firestore');
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      throw new Error('GCP_PROJECT_ID environment variable is required');
    }
    _db = new mod.Firestore({ projectId });
    _FieldValue = mod.FieldValue;
  } catch (err) {
    _db = null;
    _FieldValue = null;
    _initPromise = null; // 次の呼び出しでリトライ可能にする
    throw err;
  }
}

/**
 * ??=はJSシングルスレッドで原子的に動作するため、失敗後のリトライでも
 * 最初の呼び出しだけがinitialize()を開始し、後続は同じPromiseを共有する。
 */
export async function getFirestore(): Promise<Firestore> {
  _initPromise ??= initialize();
  await _initPromise;
  return _db!;
}

export async function getFieldValue(): Promise<typeof FieldValueType> {
  _initPromise ??= initialize();
  await _initPromise;
  return _FieldValue!;
}

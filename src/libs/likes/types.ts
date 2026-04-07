/** スキ状態のレスポンス */
export interface LikeStatus {
  count: number;
  liked: boolean;
}

/** Firestoreドキュメント（パース済み） */
export interface FirestoreDocument {
  fields: Record<string, FirestoreValue>;
}

/** Firestoreの型付きフィールド値 */
export type FirestoreValue =
  | { booleanValue: boolean }
  | { integerValue: string }
  | { stringValue: string }
  | { mapValue: { fields: Record<string, FirestoreValue> } }
  | { nullValue: null };

/** Firestore commit APIのWriteオブジェクト */
export interface FirestoreWrite {
  update: {
    name: string;
    fields: Record<string, FirestoreValue>;
  };
  updateMask?: {
    fieldPaths: string[];
  };
}

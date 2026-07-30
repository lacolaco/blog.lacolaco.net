/** Web Share API の利用可能性 */
export type ShareAvailability = 'available' | 'unavailable';

/** 共有するコンテンツ */
export type ShareContent = {
  title: string;
  url: string;
};

/**
 * 共有の実行結果
 * - success: 共有シートでの共有が完了した（共有先アプリは取得できない）
 * - cancelled: ユーザーが共有シートを閉じた（AbortError）。エラーではない
 * - unavailable: Web Share API 非対応
 * - error: 上記以外の失敗
 */
export type ShareResult =
  | { status: 'success' }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'error'; message: string };

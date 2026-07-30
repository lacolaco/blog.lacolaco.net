/**
 * Share モジュール
 * Web Share API ラッパー
 */

// 型定義
export type { ShareAvailability, ShareContent, ShareResult } from './types';

// Feature Detection
export { checkShareAvailability } from './feature-detection';

// Share Functions
export { shareContent } from './share';

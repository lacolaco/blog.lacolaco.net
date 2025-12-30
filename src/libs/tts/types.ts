/**
 * TTS（Text-to-Speech）機能の型定義
 */

/** TTS利用可能状態 */
export type TTSAvailability = 'available' | 'unavailable';

/** 言語コード → BCP47言語タグ変換 */
export function getLanguageTag(locale: string): string {
  return locale === 'en' ? 'en-US' : 'ja-JP';
}

/** 言語コード → 言語プレフィックス */
export function getLanguagePrefix(locale: string): string {
  return locale === 'en' ? 'en' : 'ja';
}

/** TTS再生成功結果 */
export interface TTSSuccess {
  success: true;
  /** 再生を停止する関数 */
  stop: () => void;
}

/** TTSエラー結果 */
export interface TTSError {
  success: false;
  error: string;
}

/** TTS再生結果 */
export type TTSResult = TTSSuccess | TTSError;

/** TTS再生コールバック */
export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: string) => void;
}

/** テキスト長制限（ブラウザ依存、安全な値） */
export const MAX_TEXT_LENGTH = 4000;

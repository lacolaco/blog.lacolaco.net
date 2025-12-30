/**
 * TTS（Text-to-Speech）機能の型定義
 */

/** TTS再生状態 */
export type TTSState = 'idle' | 'playing' | 'paused';

/** Feature Detection結果 */
export type TTSAvailability = 'available' | 'unavailable';

/** TTSオプション */
export interface TTSOptions {
  /** 言語コード（'ja' | 'en'） */
  locale: string;
  /** 読み上げ速度（0.1 - 10、デフォルト: 1） */
  rate?: number;
  /** 音の高さ（0 - 2、デフォルト: 1） */
  pitch?: number;
}

/** TTSイベントコールバック */
export interface TTSCallbacks {
  onStart?: () => void;
  onEnd?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onError?: (error: SpeechSynthesisErrorEvent) => void;
}

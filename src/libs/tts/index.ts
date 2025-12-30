/**
 * TTS (Text-to-Speech) モジュール
 * Web Speech API (SpeechSynthesis) ラッパー
 */

// 型定義
export type { TTSAvailability, TTSResult, TTSSuccess, TTSError, TTSErrorCode, TTSCallbacks } from './types';
export { MAX_TEXT_LENGTH, TTS_ERROR_CODES } from './types';

// Feature Detection
export { checkTTSAvailability } from './feature-detection';

// TTS Functions
export { initVoices, speak, stopSpeaking } from './speech';

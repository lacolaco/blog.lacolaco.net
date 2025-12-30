/**
 * TTS (Text-to-Speech) モジュール
 * Web Speech API (SpeechSynthesis) ラッパー
 */

// 型定義
export type { TTSState, TTSAvailability, TTSOptions, TTSCallbacks } from './types';

// Feature Detection
export { checkTTSAvailability, getVoiceForLocale, waitForVoices } from './feature-detection';

// TTS Controller
export { TTSController } from './speech';

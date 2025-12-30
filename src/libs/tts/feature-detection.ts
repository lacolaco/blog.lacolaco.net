import type { TTSAvailability } from './types';
import { getLanguagePrefix } from './types';

/**
 * Web Speech API (TTS) の利用可能性を確認
 */
export function checkTTSAvailability(): TTSAvailability {
  if (typeof speechSynthesis === 'undefined') {
    return 'unavailable';
  }
  return 'available';
}

/**
 * 音声リストの読み込みを待機
 * Safari対応: onvoiceschangedが発火しない場合のタイムアウト付き
 */
export function waitForVoices(timeoutMs = 1000): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof speechSynthesis === 'undefined') {
      resolve([]);
      return;
    }

    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    // Safari対応: onvoiceschangedが発火しない場合のタイムアウト
    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        // タイムアウト後に再度取得を試みる
        resolve(speechSynthesis.getVoices());
      }
    }, timeoutMs);

    speechSynthesis.onvoiceschanged = () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(speechSynthesis.getVoices());
      }
    };
  });
}

/**
 * 指定言語に最適な音声を選択
 * 優先順位: default音声 > 完全一致 > プレフィックス一致
 */
export function selectVoiceForLocale(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | null {
  if (voices.length === 0) {
    return null;
  }

  const langPrefix = getLanguagePrefix(locale);

  // 該当言語の音声をフィルタ
  const matchingVoices = voices.filter((v) => v.lang.startsWith(langPrefix));

  if (matchingVoices.length === 0) {
    return null;
  }

  // default音声を優先
  const defaultVoice = matchingVoices.find((v) => v.default);
  if (defaultVoice) {
    return defaultVoice;
  }

  // localService（ローカル音声）を優先（品質が良い傾向）
  const localVoice = matchingVoices.find((v) => v.localService);
  if (localVoice) {
    return localVoice;
  }

  // それ以外は最初の音声
  return matchingVoices[0];
}

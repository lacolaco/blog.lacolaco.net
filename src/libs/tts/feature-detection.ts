import type { TTSAvailability } from './types';

/**
 * Web Speech API (TTS) の利用可能性を確認
 * @returns 'available' | 'unavailable'
 */
export function checkTTSAvailability(): TTSAvailability {
  // SpeechSynthesis APIの存在確認
  if (typeof speechSynthesis === 'undefined') {
    return 'unavailable';
  }

  return 'available';
}

/**
 * 指定言語の音声を取得
 * @param locale 言語コード ('ja' | 'en')
 * @returns 言語に対応する音声、見つからない場合はnull
 */
export function getVoiceForLocale(locale: string): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') {
    return null;
  }

  const voices = speechSynthesis.getVoices();
  if (voices.length === 0) {
    return null;
  }

  const langCode = locale === 'en' ? 'en' : 'ja';

  // 優先順位: 完全一致（ja-JP, en-US）> 言語プレフィックス一致
  return (
    voices.find((v) => v.lang === `${langCode}-JP` || v.lang === `${langCode}-US`) ||
    voices.find((v) => v.lang.startsWith(langCode)) ||
    null
  );
}

/**
 * 音声リストの読み込みを待機（非同期）
 * ブラウザによっては音声リストの読み込みが遅延する
 */
export function waitForVoices(): Promise<SpeechSynthesisVoice[]> {
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

    // onvoiceschangedイベントで音声リスト取得
    speechSynthesis.onvoiceschanged = () => {
      resolve(speechSynthesis.getVoices());
    };
  });
}

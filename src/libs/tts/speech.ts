import { selectVoiceForLocale, waitForVoices } from './feature-detection';
import { getLanguageTag, MAX_TEXT_LENGTH, TTS_ERROR_CODES, type TTSCallbacks, type TTSResult } from './types';

/** 音声リストのキャッシュ */
let cachedVoices: SpeechSynthesisVoice[] | null = null;

/**
 * 音声リストを初期化（コンポーネントマウント時に呼び出す）
 */
export async function initVoices(): Promise<void> {
  if (cachedVoices === null) {
    cachedVoices = await waitForVoices();
  }
}

/**
 * Safari対応: cancel()だけでは音声がクリアされない場合の対策
 */
function safariSafeCancel(): void {
  speechSynthesis.cancel();
  // Safari workaround: pause()を呼ぶことで確実に停止
  if (speechSynthesis.speaking || speechSynthesis.pending) {
    speechSynthesis.pause();
    speechSynthesis.resume();
    speechSynthesis.cancel();
  }
}

/**
 * テキストを読み上げる
 * @param text 読み上げるテキスト
 * @param locale 言語コード ('ja' | 'en')
 * @param rate 読み上げ速度（0.1-10、デフォルト1.2）
 * @param callbacks コールバック関数
 * @returns 停止関数を含むオブジェクト、または長文エラー時はnull
 */
export function speak(text: string, locale: string, rate: number, callbacks?: TTSCallbacks): TTSResult {
  // 空文字チェック
  if (!text.trim()) {
    return { success: false, errorCode: TTS_ERROR_CODES.EMPTY_TEXT, error: 'Empty text' };
  }

  // 長文チェック
  if (text.length > MAX_TEXT_LENGTH) {
    return {
      success: false,
      errorCode: TTS_ERROR_CODES.TEXT_TOO_LONG,
      error: `Text too long (max ${MAX_TEXT_LENGTH} characters)`,
    };
  }

  // 既存の再生を停止
  safariSafeCancel();

  const utterance = new SpeechSynthesisUtterance(text);

  // 言語設定
  utterance.lang = getLanguageTag(locale);

  // 音声選択（キャッシュから）
  if (cachedVoices && cachedVoices.length > 0) {
    const voice = selectVoiceForLocale(cachedVoices, locale);
    if (voice) {
      utterance.voice = voice;
    }
  }

  // 速度設定
  utterance.rate = rate;

  // イベントハンドラ
  utterance.onstart = () => {
    callbacks?.onStart?.();
  };

  utterance.onend = () => {
    callbacks?.onEnd?.();
  };

  utterance.onerror = (event) => {
    // エラー時は確実に停止
    safariSafeCancel();
    // canceledは正常な中断なのでエラー扱いしない
    if (event.error !== 'canceled') {
      callbacks?.onError?.(event.error);
    }
  };

  // 再生開始
  speechSynthesis.speak(utterance);

  // 停止関数を返す
  return {
    success: true,
    stop: () => {
      safariSafeCancel();
    },
  };
}

/**
 * 現在の再生を停止
 */
export function stopSpeaking(): void {
  safariSafeCancel();
}

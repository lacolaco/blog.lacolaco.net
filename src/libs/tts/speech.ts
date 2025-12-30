import type { TTSOptions, TTSCallbacks, TTSState } from './types';
import { getVoiceForLocale } from './feature-detection';

/**
 * TTSコントローラークラス
 * Web Speech API (SpeechSynthesis) のラッパー
 * Play / Pause / Stop のフルコントロールを提供
 */
export class TTSController {
  private utterance: SpeechSynthesisUtterance | null = null;
  private _state: TTSState = 'idle';
  private callbacks: TTSCallbacks = {};

  /** 現在の再生状態 */
  get state(): TTSState {
    return this._state;
  }

  /**
   * テキストの読み上げを開始
   * @param text 読み上げるテキスト
   * @param options 言語・速度等のオプション
   * @param callbacks イベントコールバック
   */
  speak(text: string, options: TTSOptions, callbacks?: TTSCallbacks): void {
    // 既存の読み上げをキャンセル
    this.stop();

    if (!text.trim()) {
      return;
    }

    this.callbacks = callbacks || {};
    this.utterance = new SpeechSynthesisUtterance(text);

    // 言語設定
    const langCode = options.locale === 'en' ? 'en-US' : 'ja-JP';
    this.utterance.lang = langCode;

    // 音声選択（利用可能な場合）
    const voice = getVoiceForLocale(options.locale);
    if (voice) {
      this.utterance.voice = voice;
    }

    // オプション設定
    this.utterance.rate = options.rate ?? 1;
    this.utterance.pitch = options.pitch ?? 1;

    // イベントリスナー設定
    this.utterance.onstart = () => {
      this._state = 'playing';
      this.callbacks.onStart?.();
    };

    this.utterance.onend = () => {
      this._state = 'idle';
      this.callbacks.onEnd?.();
    };

    this.utterance.onpause = () => {
      this._state = 'paused';
      this.callbacks.onPause?.();
    };

    this.utterance.onresume = () => {
      this._state = 'playing';
      this.callbacks.onResume?.();
    };

    this.utterance.onerror = (event) => {
      this._state = 'idle';
      this.callbacks.onError?.(event);
    };

    speechSynthesis.speak(this.utterance);
  }

  /**
   * 一時停止
   */
  pause(): void {
    if (this._state === 'playing') {
      speechSynthesis.pause();
    }
  }

  /**
   * 再開
   */
  resume(): void {
    if (this._state === 'paused') {
      speechSynthesis.resume();
    }
  }

  /**
   * 停止（キャンセル）
   */
  stop(): void {
    speechSynthesis.cancel();
    this._state = 'idle';
    this.utterance = null;
  }

  /**
   * リソース解放
   */
  destroy(): void {
    this.stop();
    this.callbacks = {};
  }
}

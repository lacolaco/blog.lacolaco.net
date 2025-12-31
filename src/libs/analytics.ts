/// <reference types="gtag.js" />

/** 汎用イベント型 */
export interface AnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

/** イベント送信 */
export function trackEvent(event: AnalyticsEvent): void {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', event.name, event.params);
  }
}

/** Summarizerイベントファクトリー */
export const summarizerEvents = {
  start: (): AnalyticsEvent => ({ name: 'summarize_start' }),
  complete: (): AnalyticsEvent => ({ name: 'summarize_complete' }),
  error: (errorMessage: string): AnalyticsEvent => ({
    name: 'summarize_error',
    params: { error_message: errorMessage },
  }),
};

/** TTSイベントファクトリー */
export const ttsEvents = {
  start: (): AnalyticsEvent => ({ name: 'tts_start' }),
  complete: (): AnalyticsEvent => ({ name: 'tts_complete' }),
  error: (errorMessage: string): AnalyticsEvent => ({
    name: 'tts_error',
    params: { error_message: errorMessage },
  }),
};

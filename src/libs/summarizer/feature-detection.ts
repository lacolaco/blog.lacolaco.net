/// <reference types="@types/dom-chromium-ai" />
import type { AvailabilityResult } from './types';

/**
 * Summarizer APIの利用可能状態を確認する
 * @param locale 記事の言語（言語別の利用可能状態を確認）
 * @returns 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported'
 */
export async function checkSummarizerAvailability(locale?: string): Promise<AvailabilityResult> {
  // Feature Detection: Summarizer APIが存在するか
  if (typeof Summarizer === 'undefined') {
    return 'unsupported';
  }

  try {
    const outputLanguage = locale === 'en' ? 'en' : 'ja';
    const availability = await Summarizer.availability({
      type: 'tldr',
      format: 'plain-text',
      length: 'medium',
      outputLanguage,
      expectedInputLanguages: [outputLanguage],
    });
    return availability;
  } catch (error) {
    console.error('Summarizer availability check failed:', error);
    return 'unsupported';
  }
}

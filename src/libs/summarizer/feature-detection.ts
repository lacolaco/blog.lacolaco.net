import type { AvailabilityResult, SummarizerConstructor } from './types';

// グローバルにSummarizer APIを追加（ブラウザAPIとして存在する場合）
declare global {
  var Summarizer: SummarizerConstructor | undefined;
}

/**
 * Summarizer APIの利用可能状態を確認する
 * @returns 'available' | 'downloadable' | 'unavailable' | 'unsupported'
 */
export async function checkSummarizerAvailability(): Promise<AvailabilityResult> {
  // Feature Detection: Summarizer APIが存在するか
  if (!('Summarizer' in globalThis) || !globalThis.Summarizer) {
    return 'unsupported';
  }

  try {
    const availability = await globalThis.Summarizer.availability();
    return availability;
  } catch (error) {
    console.error('Summarizer availability check failed:', error);
    return 'unsupported';
  }
}

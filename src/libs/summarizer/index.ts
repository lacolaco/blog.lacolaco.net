/**
 * Chrome Summarizer API ラッパー
 * @see https://developer.chrome.com/docs/ai/summarizer-api
 */

// 型定義
export type {
  SummarizerAvailability,
  SummarizerCreateOptions,
  Summarizer,
  SummarizerConstructor,
  AvailabilityResult,
} from './types';

// Feature Detection
export { checkSummarizerAvailability } from './feature-detection';

// Summarizer API
export { createSummarizer, summarizeTextStream, type SummarizeOptions } from './summarizer';

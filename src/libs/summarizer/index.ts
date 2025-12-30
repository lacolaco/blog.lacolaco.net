/**
 * Chrome Summarizer API ラッパー
 * @see https://developer.chrome.com/docs/ai/summarizer-api
 */

/// <reference types="@types/dom-chromium-ai" />

// 型定義
export type { AvailabilityResult } from './types';

// Feature Detection
export { checkSummarizerAvailability } from './feature-detection';

// Summarizer API
export { createSummarizer, summarizeTextStream, type SummarizeOptions } from './summarizer';

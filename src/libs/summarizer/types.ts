/**
 * Chrome Summarizer API の型定義
 * @see https://developer.chrome.com/docs/ai/summarizer-api
 * @see @types/dom-chromium-ai
 */

/// <reference types="@types/dom-chromium-ai" />

/** Feature Detection結果（unsupportedを含む） */
export type AvailabilityResult = Availability | 'unsupported';

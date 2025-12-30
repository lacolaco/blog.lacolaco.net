/**
 * Chrome Summarizer API の型定義
 * @see https://developer.chrome.com/docs/ai/summarizer-api
 */

/** Summarizer APIの利用可能状態 */
export type SummarizerAvailability = 'available' | 'downloadable' | 'unavailable';

/** Summarizer作成時のオプション */
export interface SummarizerCreateOptions {
  /** 要約タイプ */
  type: 'tldr' | 'key-points' | 'teaser' | 'headline';
  /** 出力形式 */
  format: 'markdown' | 'plain-text';
  /** 出力長さ */
  length: 'short' | 'medium' | 'long';
  /** 共有コンテキスト */
  sharedContext?: string;
  /** 出力言語 */
  outputLanguage?: string;
}

/** Summarizerインスタンス */
export interface Summarizer {
  /** テキストを要約する */
  summarize(text: string, options?: { context?: string }): Promise<string>;
  /** テキストをストリーミングで要約する */
  summarizeStreaming(text: string, options?: { context?: string }): ReadableStream<string>;
  /** リソースを解放する */
  destroy(): void;
}

/** Summarizer APIのコンストラクタインターフェース */
export interface SummarizerConstructor {
  /** APIの利用可能状態を確認 */
  availability(): Promise<SummarizerAvailability>;
  /** Summarizerインスタンスを作成 */
  create(options?: SummarizerCreateOptions): Promise<Summarizer>;
}

/** Feature Detection結果（unsupportedを含む） */
export type AvailabilityResult = SummarizerAvailability | 'unsupported';

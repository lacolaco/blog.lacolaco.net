/// <reference types="@types/dom-chromium-ai" />

/** 要約オプション */
export interface SummarizeOptions {
  /** 記事の言語（出力言語の指定に使用） */
  locale: string;
  /** 入力テキストの最大長（デフォルト: 50000） */
  maxLength?: number;
  /** キャンセル用のAbortSignal */
  signal?: AbortSignal;
}

const DEFAULT_MAX_LENGTH = 50000;

/**
 * Summarizerインスタンスを作成する
 * @param locale 出力言語
 */
export async function createSummarizer(locale: string): Promise<Summarizer> {
  if (typeof Summarizer === 'undefined') {
    throw new Error('Summarizer API is not available');
  }

  const outputLanguage = locale === 'en' ? 'en' : 'ja';
  const options: SummarizerCreateOptions = {
    type: 'tldr',
    format: 'plain-text',
    length: 'medium',
    outputLanguage,
    expectedInputLanguages: [outputLanguage],
  };

  return await Summarizer.create(options);
}

/**
 * テキストをストリーミングで要約する
 * @param text 要約対象のテキスト
 * @param options 要約オプション
 * @param onChunk チャンク受信時のコールバック（累積テキストを受け取る）
 */
export async function summarizeTextStream(
  text: string,
  options: SummarizeOptions,
  onChunk: (text: string) => void,
): Promise<void> {
  const { locale, maxLength = DEFAULT_MAX_LENGTH, signal } = options;

  if (!text.trim()) {
    throw new Error('Text is empty');
  }

  const truncatedText = text.slice(0, maxLength);
  const summarizer = await createSummarizer(locale);

  try {
    const stream = summarizer.summarizeStreaming(truncatedText);
    const reader = stream.getReader();

    while (true) {
      // キャンセルされた場合は中断
      if (signal?.aborted) {
        await reader.cancel();
        break;
      }
      const { done, value } = await reader.read();
      if (done) break;
      onChunk(value);
    }
  } finally {
    summarizer.destroy();
  }
}

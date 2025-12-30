/// <reference types="@types/dom-chromium-ai" />
import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkSummarizerAvailability } from './feature-detection';

// テスト用のモック型
type MockSummarizer = {
  availability: ReturnType<typeof vi.fn>;
};

// テスト用にglobalThisにSummarizerを追加するヘルパー
function setSummarizer(value: MockSummarizer | null): void {
  (globalThis as unknown as { Summarizer: MockSummarizer | null }).Summarizer = value;
}

function clearSummarizer(): void {
  if ('Summarizer' in globalThis) {
    delete (globalThis as unknown as { Summarizer?: unknown }).Summarizer;
  }
}

describe('checkSummarizerAvailability', () => {
  // 各テスト後にglobalThis.Summarizerをクリーンアップ
  afterEach(() => {
    clearSummarizer();
  });

  it('Summarizer APIが存在しない場合、unsupportedを返す', async () => {
    const result = await checkSummarizerAvailability();
    expect(result).toBe('unsupported');
  });

  it('availability()がavailableを返す場合、availableを返す', async () => {
    setSummarizer({
      availability: vi.fn().mockResolvedValue('available'),
    });

    const result = await checkSummarizerAvailability();
    expect(result).toBe('available');
  });

  it('availability()がdownloadableを返す場合、downloadableを返す', async () => {
    setSummarizer({
      availability: vi.fn().mockResolvedValue('downloadable'),
    });

    const result = await checkSummarizerAvailability();
    expect(result).toBe('downloadable');
  });

  it('availability()がunavailableを返す場合、unavailableを返す', async () => {
    setSummarizer({
      availability: vi.fn().mockResolvedValue('unavailable'),
    });

    const result = await checkSummarizerAvailability();
    expect(result).toBe('unavailable');
  });

  it('availability()がエラーを投げた場合、unsupportedを返す', async () => {
    setSummarizer({
      availability: vi.fn().mockRejectedValue(new Error('API Error')),
    });

    const result = await checkSummarizerAvailability();
    expect(result).toBe('unsupported');
  });

  it('Summarizerがnullの場合、unsupportedを返す', async () => {
    setSummarizer(null);

    const result = await checkSummarizerAvailability();
    expect(result).toBe('unsupported');
  });

  it('localeを指定した場合、該当言語の利用可能状態を確認する', async () => {
    const mockAvailability = vi.fn().mockResolvedValue('available');
    setSummarizer({
      availability: mockAvailability,
    });

    await checkSummarizerAvailability('ja');

    expect(mockAvailability).toHaveBeenCalledWith({
      type: 'tldr',
      format: 'markdown',
      length: 'medium',
      outputLanguage: 'ja',
      expectedInputLanguages: ['ja'],
    });
  });

  it('locale=enの場合、英語の利用可能状態を確認する', async () => {
    const mockAvailability = vi.fn().mockResolvedValue('available');
    setSummarizer({
      availability: mockAvailability,
    });

    await checkSummarizerAvailability('en');

    expect(mockAvailability).toHaveBeenCalledWith({
      type: 'tldr',
      format: 'markdown',
      length: 'medium',
      outputLanguage: 'en',
      expectedInputLanguages: ['en'],
    });
  });
});

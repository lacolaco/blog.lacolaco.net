import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkSummarizerAvailability } from './feature-detection';
import type { SummarizerConstructor } from './types';

// テスト用にglobalThisにSummarizerを追加するヘルパー
function setSummarizer(value: Partial<SummarizerConstructor> | null): void {
  (globalThis as unknown as { Summarizer: Partial<SummarizerConstructor> | null }).Summarizer = value;
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
});

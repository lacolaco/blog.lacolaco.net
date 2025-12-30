import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkTTSAvailability, getVoiceForLocale } from './feature-detection';

// テスト用のモック型
type MockSpeechSynthesis = {
  getVoices: ReturnType<typeof vi.fn>;
  onvoiceschanged?: () => void;
};

// テスト用にglobalThisにspeechSynthesisを設定するヘルパー
function setSpeechSynthesis(value: MockSpeechSynthesis | undefined): void {
  (globalThis as unknown as { speechSynthesis: MockSpeechSynthesis | undefined }).speechSynthesis = value;
}

function clearSpeechSynthesis(): void {
  if ('speechSynthesis' in globalThis) {
    delete (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  }
}

describe('checkTTSAvailability', () => {
  afterEach(() => {
    clearSpeechSynthesis();
  });

  it('speechSynthesisが存在しない場合、unavailableを返す', () => {
    const result = checkTTSAvailability();
    expect(result).toBe('unavailable');
  });

  it('speechSynthesisが存在する場合、availableを返す', () => {
    setSpeechSynthesis({
      getVoices: vi.fn().mockReturnValue([]),
    });

    const result = checkTTSAvailability();
    expect(result).toBe('available');
  });
});

describe('getVoiceForLocale', () => {
  afterEach(() => {
    clearSpeechSynthesis();
  });

  it('speechSynthesisが存在しない場合、nullを返す', () => {
    const result = getVoiceForLocale('ja');
    expect(result).toBeNull();
  });

  it('音声リストが空の場合、nullを返す', () => {
    setSpeechSynthesis({
      getVoices: vi.fn().mockReturnValue([]),
    });

    const result = getVoiceForLocale('ja');
    expect(result).toBeNull();
  });

  it('locale=jaの場合、ja-JPまたはjaで始まる音声を返す', () => {
    const jaVoice = { lang: 'ja-JP', name: 'Japanese Voice' };
    const enVoice = { lang: 'en-US', name: 'English Voice' };
    setSpeechSynthesis({
      getVoices: vi.fn().mockReturnValue([enVoice, jaVoice]),
    });

    const result = getVoiceForLocale('ja');
    expect(result).toEqual(jaVoice);
  });

  it('locale=enの場合、en-USまたはenで始まる音声を返す', () => {
    const jaVoice = { lang: 'ja-JP', name: 'Japanese Voice' };
    const enVoice = { lang: 'en-US', name: 'English Voice' };
    setSpeechSynthesis({
      getVoices: vi.fn().mockReturnValue([jaVoice, enVoice]),
    });

    const result = getVoiceForLocale('en');
    expect(result).toEqual(enVoice);
  });

  it('完全一致がない場合、言語プレフィックスで一致する音声を返す', () => {
    const jaVoice = { lang: 'ja', name: 'Japanese Voice' };
    setSpeechSynthesis({
      getVoices: vi.fn().mockReturnValue([jaVoice]),
    });

    const result = getVoiceForLocale('ja');
    expect(result).toEqual(jaVoice);
  });

  it('該当言語の音声がない場合、nullを返す', () => {
    const frVoice = { lang: 'fr-FR', name: 'French Voice' };
    setSpeechSynthesis({
      getVoices: vi.fn().mockReturnValue([frVoice]),
    });

    const result = getVoiceForLocale('ja');
    expect(result).toBeNull();
  });
});

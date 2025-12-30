import { describe, it, expect, vi, afterEach } from 'vitest';
import { checkTTSAvailability, selectVoiceForLocale } from './feature-detection';

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

describe('selectVoiceForLocale', () => {
  it('音声リストが空の場合、nullを返す', () => {
    const result = selectVoiceForLocale([], 'ja');
    expect(result).toBeNull();
  });

  it('locale=jaの場合、ja-JPまたはjaで始まる音声を返す', () => {
    const jaVoice = { lang: 'ja-JP', name: 'Japanese Voice' } as SpeechSynthesisVoice;
    const enVoice = { lang: 'en-US', name: 'English Voice' } as SpeechSynthesisVoice;

    const result = selectVoiceForLocale([enVoice, jaVoice], 'ja');
    expect(result).toEqual(jaVoice);
  });

  it('locale=enの場合、en-USまたはenで始まる音声を返す', () => {
    const jaVoice = { lang: 'ja-JP', name: 'Japanese Voice' } as SpeechSynthesisVoice;
    const enVoice = { lang: 'en-US', name: 'English Voice' } as SpeechSynthesisVoice;

    const result = selectVoiceForLocale([jaVoice, enVoice], 'en');
    expect(result).toEqual(enVoice);
  });

  it('完全一致がない場合、言語プレフィックスで一致する音声を返す', () => {
    const jaVoice = { lang: 'ja', name: 'Japanese Voice' } as SpeechSynthesisVoice;

    const result = selectVoiceForLocale([jaVoice], 'ja');
    expect(result).toEqual(jaVoice);
  });

  it('該当言語の音声がない場合、nullを返す', () => {
    const frVoice = { lang: 'fr-FR', name: 'French Voice' } as SpeechSynthesisVoice;

    const result = selectVoiceForLocale([frVoice], 'ja');
    expect(result).toBeNull();
  });

  it('default音声を優先する', () => {
    const defaultVoice = { lang: 'ja-JP', name: 'Default', default: true } as SpeechSynthesisVoice;
    const otherVoice = { lang: 'ja-JP', name: 'Other', default: false } as SpeechSynthesisVoice;

    const result = selectVoiceForLocale([otherVoice, defaultVoice], 'ja');
    expect(result).toEqual(defaultVoice);
  });

  it('defaultがない場合、localService音声を優先する', () => {
    const localVoice = { lang: 'ja-JP', name: 'Local', localService: true, default: false } as SpeechSynthesisVoice;
    const remoteVoice = { lang: 'ja-JP', name: 'Remote', localService: false, default: false } as SpeechSynthesisVoice;

    const result = selectVoiceForLocale([remoteVoice, localVoice], 'ja');
    expect(result).toEqual(localVoice);
  });
});

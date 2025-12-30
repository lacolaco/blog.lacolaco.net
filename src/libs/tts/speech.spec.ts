import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { speak, stopSpeaking } from './speech';
import { MAX_TEXT_LENGTH } from './types';

// SpeechSynthesisUtteranceのモック
class MockUtterance {
  text: string;
  lang: string = '';
  rate: number = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

// SpeechSynthesisのモック
type MockSpeechSynthesis = {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
  speaking: boolean;
  pending: boolean;
};

let mockSpeechSynthesis: MockSpeechSynthesis;
let lastUtterance: MockUtterance | null = null;

function setupMocks(): void {
  mockSpeechSynthesis = {
    speak: vi.fn((utterance: MockUtterance) => {
      lastUtterance = utterance;
      // onstartを即座に呼び出す
      utterance.onstart?.();
    }),
    cancel: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    getVoices: vi.fn().mockReturnValue([]),
    speaking: false,
    pending: false,
  };

  (globalThis as unknown as { speechSynthesis: MockSpeechSynthesis }).speechSynthesis = mockSpeechSynthesis;
  (globalThis as unknown as { SpeechSynthesisUtterance: typeof MockUtterance }).SpeechSynthesisUtterance =
    MockUtterance;
}

function clearMocks(): void {
  if ('speechSynthesis' in globalThis) {
    delete (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  }
  if ('SpeechSynthesisUtterance' in globalThis) {
    delete (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
  }
  lastUtterance = null;
}

describe('speak', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    clearMocks();
  });

  it('空文字の場合、エラーを返す', () => {
    const result = speak('', 'ja', 1.0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Empty text');
    }
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('空白のみの場合、エラーを返す', () => {
    const result = speak('   ', 'ja', 1.0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe('Empty text');
    }
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('長文の場合、エラーを返す', () => {
    const longText = 'a'.repeat(MAX_TEXT_LENGTH + 1);
    const result = speak(longText, 'ja', 1.0);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('too long');
    }
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it('テキストを渡すとSpeechSynthesisUtteranceを作成してspeakを呼ぶ', () => {
    const result = speak('こんにちは', 'ja', 1.0);

    expect(result.success).toBe(true);
    expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    expect(lastUtterance?.text).toBe('こんにちは');
  });

  it('locale=jaの場合、lang=ja-JPを設定', () => {
    speak('テスト', 'ja', 1.0);

    expect(lastUtterance?.lang).toBe('ja-JP');
  });

  it('locale=enの場合、lang=en-USを設定', () => {
    speak('Hello', 'en', 1.0);

    expect(lastUtterance?.lang).toBe('en-US');
  });

  it('rateオプションを設定', () => {
    speak('テスト', 'ja', 1.5);

    expect(lastUtterance?.rate).toBe(1.5);
  });

  it('onStartコールバックが呼ばれる', () => {
    const onStart = vi.fn();
    speak('テスト', 'ja', 1.0, { onStart });

    expect(onStart).toHaveBeenCalled();
  });

  it('onEndコールバックが呼ばれる', () => {
    const onEnd = vi.fn();
    speak('テスト', 'ja', 1.0, { onEnd });

    // onendイベントをシミュレート
    lastUtterance?.onend?.();

    expect(onEnd).toHaveBeenCalled();
  });

  it('onErrorコールバックがcanceled以外で呼ばれる', () => {
    const onError = vi.fn();
    speak('テスト', 'ja', 1.0, { onError });

    // onerrorイベントをシミュレート
    lastUtterance?.onerror?.({ error: 'network' });

    expect(onError).toHaveBeenCalledWith('network');
  });

  it('canceledエラーではonErrorコールバックが呼ばれない', () => {
    const onError = vi.fn();
    speak('テスト', 'ja', 1.0, { onError });

    // canceledエラーをシミュレート
    lastUtterance?.onerror?.({ error: 'canceled' });

    expect(onError).not.toHaveBeenCalled();
  });

  it('成功時はstop関数を含むオブジェクトを返す', () => {
    const result = speak('テスト', 'ja', 1.0);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.stop).toBe('function');
    }
  });

  it('stop関数を呼ぶとspeechSynthesis.cancelが呼ばれる', () => {
    const result = speak('テスト', 'ja', 1.0);

    if (result.success) {
      result.stop();
    }

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});

describe('stopSpeaking', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    clearMocks();
  });

  it('speechSynthesis.cancelが呼ばれる', () => {
    stopSpeaking();

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});

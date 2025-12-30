import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { TTSController } from './speech';

// SpeechSynthesisUtteranceのモック
class MockUtterance {
  text: string;
  lang: string = '';
  rate: number = 1;
  pitch: number = 1;
  voice: SpeechSynthesisVoice | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

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

describe('TTSController', () => {
  beforeEach(() => {
    setupMocks();
  });

  afterEach(() => {
    clearMocks();
  });

  describe('speak', () => {
    it('空文字の場合、何もしない', () => {
      const controller = new TTSController();
      controller.speak('', { locale: 'ja' });

      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('空白のみの場合、何もしない', () => {
      const controller = new TTSController();
      controller.speak('   ', { locale: 'ja' });

      expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
    });

    it('テキストを渡すとSpeechSynthesisUtteranceを作成してspeakを呼ぶ', () => {
      const controller = new TTSController();
      controller.speak('こんにちは', { locale: 'ja' });

      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
      expect(lastUtterance?.text).toBe('こんにちは');
    });

    it('locale=jaの場合、lang=ja-JPを設定', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja' });

      expect(lastUtterance?.lang).toBe('ja-JP');
    });

    it('locale=enの場合、lang=en-USを設定', () => {
      const controller = new TTSController();
      controller.speak('Hello', { locale: 'en' });

      expect(lastUtterance?.lang).toBe('en-US');
    });

    it('rate, pitchオプションを設定', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja', rate: 1.5, pitch: 0.8 });

      expect(lastUtterance?.rate).toBe(1.5);
      expect(lastUtterance?.pitch).toBe(0.8);
    });

    it('onStartコールバックが呼ばれる', () => {
      const controller = new TTSController();
      const onStart = vi.fn();
      controller.speak('テスト', { locale: 'ja' }, { onStart });

      expect(onStart).toHaveBeenCalled();
    });

    it('onEndコールバックが呼ばれる', () => {
      const controller = new TTSController();
      const onEnd = vi.fn();
      controller.speak('テスト', { locale: 'ja' }, { onEnd });

      // onendイベントをシミュレート
      lastUtterance?.onend?.();

      expect(onEnd).toHaveBeenCalled();
    });

    it('既存の読み上げをキャンセルしてから新しい読み上げを開始', () => {
      const controller = new TTSController();
      controller.speak('最初', { locale: 'ja' });
      controller.speak('次', { locale: 'ja' });

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('pause', () => {
    it('playing状態でpauseを呼ぶとspeechSynthesis.pauseが呼ばれる', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja' });

      controller.pause();

      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
    });

    it('idle状態では何も起きない', () => {
      const controller = new TTSController();
      controller.pause();

      expect(mockSpeechSynthesis.pause).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('paused状態でresumeを呼ぶとspeechSynthesis.resumeが呼ばれる', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja' });

      // pauseイベントをシミュレート
      controller.pause();
      lastUtterance?.onpause?.();

      controller.resume();

      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });

    it('idle状態では何も起きない', () => {
      const controller = new TTSController();
      controller.resume();

      expect(mockSpeechSynthesis.resume).not.toHaveBeenCalled();
    });
  });

  describe('stop', () => {
    it('speechSynthesis.cancelが呼ばれる', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja' });

      controller.stop();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('状態がidleになる', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja' });
      expect(controller.state).toBe('playing');

      controller.stop();

      expect(controller.state).toBe('idle');
    });
  });

  describe('destroy', () => {
    it('stopが呼ばれる', () => {
      const controller = new TTSController();
      controller.speak('テスト', { locale: 'ja' });

      controller.destroy();

      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
      expect(controller.state).toBe('idle');
    });
  });
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent, ttsEvents } from '../libs/analytics';
import { checkTTSAvailability, initVoices, speak, stopSpeaking, type TTSSuccess } from '../libs/tts';

interface Props {
  text: string;
  locale: string;
}

type TTSState = 'idle' | 'playing' | 'error';

const i18n = {
  ja: {
    play: '読み上げ',
    stop: '停止',
    error: '読み上げに失敗しました',
    textTooLong: 'テキストが長すぎます',
  },
  en: {
    play: 'Read aloud',
    stop: 'Stop',
    error: 'Failed to read aloud',
    textTooLong: 'Text is too long',
  },
};

/** 読み上げ速度 */
const SPEECH_RATE = 1.2;

/**
 * TTS（読み上げ）コントロールコンポーネント
 * Web Speech APIを使用して要約を読み上げる
 */
export default function TTSControls({ text, locale }: Props) {
  const [state, setState] = useState<TTSState>('idle');
  const [available, setAvailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isMounted = useRef(true);
  const currentSpeech = useRef<TTSSuccess | null>(null);

  const t = locale === 'en' ? i18n.en : i18n.ja;

  // 初期化: Feature DetectionとVoices読み込み
  useEffect(() => {
    isMounted.current = true;

    const init = async () => {
      if (checkTTSAvailability() === 'available') {
        await initVoices();
        if (isMounted.current) {
          setAvailable(true);
        }
      }
    };

    void init();

    return () => {
      isMounted.current = false;
      stopSpeaking();
    };
  }, []);

  const handlePlay = useCallback(() => {
    // 連打防止: 再生中は何もしない
    if (state === 'playing' || !text) return;

    // エラー状態をクリア
    setErrorMessage('');

    const result = speak(text, locale, SPEECH_RATE, {
      onStart: () => {
        if (isMounted.current) {
          setState('playing');
        }
      },
      onEnd: () => {
        if (isMounted.current) {
          setState('idle');
          currentSpeech.current = null;
          trackEvent(ttsEvents.complete());
        }
      },
      onError: (error) => {
        if (isMounted.current) {
          setState('error');
          setErrorMessage(error);
          currentSpeech.current = null;
          trackEvent(ttsEvents.error(error));
        }
      },
    });

    // エラーチェック（長文など）
    if (!result.success) {
      setState('error');
      setErrorMessage(result.error.includes('too long') ? t.textTooLong : result.error);
      trackEvent(ttsEvents.error(result.error));
      return;
    }

    currentSpeech.current = result;
    trackEvent(ttsEvents.start());
  }, [text, locale, state, t.textTooLong]);

  const handleStop = useCallback(() => {
    currentSpeech.current?.stop();
    currentSpeech.current = null;
    setState('idle');
    // ユーザーによる中断はstopイベントを送信しない（completeと区別するため）
  }, []);

  const handleDismissError = useCallback(() => {
    setState('idle');
    setErrorMessage('');
  }, []);

  // TTS非対応の場合は何も表示しない
  if (!available) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      {state === 'idle' && (
        <button
          type="button"
          onClick={handlePlay}
          className="inline-flex items-center gap-x-1 px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-100 cursor-pointer transition-colors"
        >
          <span className="icon-[mdi--volume-high] inline-block w-3 h-3" />
          {t.play}
        </button>
      )}
      {state === 'playing' && (
        <button
          type="button"
          onClick={handleStop}
          className="inline-flex items-center gap-x-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 cursor-pointer transition-colors"
        >
          <span className="icon-[mdi--stop] inline-block w-3 h-3" />
          {t.stop}
        </button>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-red-600">
            <span className="icon-[mdi--alert-circle] inline-block w-3 h-3 mr-1" />
            {errorMessage || t.error}
          </span>
          <button
            type="button"
            onClick={handleDismissError}
            className="text-xs text-gray-500 hover:text-gray-700 underline cursor-pointer"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent, ttsEvents } from '../libs/analytics';
import { checkTTSAvailability, TTSController } from '../libs/tts';

interface Props {
  text: string;
  locale: string;
}

const i18n = {
  ja: {
    play: '読み上げ',
    stop: '停止',
  },
  en: {
    play: 'Read aloud',
    stop: 'Stop',
  },
};

/**
 * TTS（読み上げ）コントロールコンポーネント
 * 再生 / 停止 のシンプルなコントロールを提供
 */
export default function TTSControls({ text, locale }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [available, setAvailable] = useState(false);
  const controller = useRef<TTSController | null>(null);

  const t = locale === 'en' ? i18n.en : i18n.ja;

  useEffect(() => {
    if (checkTTSAvailability() === 'available') {
      setAvailable(true);
      controller.current = new TTSController();
    }

    return () => {
      controller.current?.destroy();
    };
  }, []);

  const handlePlay = useCallback(() => {
    if (!controller.current || !text) return;

    trackEvent(ttsEvents.start());
    controller.current.speak(
      text,
      { locale },
      {
        onStart: () => setIsPlaying(true),
        onEnd: () => {
          setIsPlaying(false);
          trackEvent(ttsEvents.complete());
        },
        onError: (e) => {
          setIsPlaying(false);
          trackEvent(ttsEvents.error(e.error));
        },
      },
    );
  }, [text, locale]);

  const handleStop = useCallback(() => {
    controller.current?.stop();
    setIsPlaying(false);
    trackEvent(ttsEvents.stop());
  }, []);

  // TTS非対応の場合は何も表示しない
  if (!available) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center gap-2">
      {!isPlaying ? (
        <button
          type="button"
          onClick={handlePlay}
          className="inline-flex items-center gap-x-1 px-2 py-1 text-xs text-blue-600 border border-blue-300 rounded hover:bg-blue-100 cursor-pointer transition-colors"
        >
          <span className="icon-[mdi--volume-high] inline-block w-3 h-3" />
          {t.play}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleStop}
          className="inline-flex items-center gap-x-1 px-2 py-1 text-xs text-gray-600 border border-gray-300 rounded hover:bg-gray-100 cursor-pointer transition-colors"
        >
          <span className="icon-[mdi--stop] inline-block w-3 h-3" />
          {t.stop}
        </button>
      )}
    </div>
  );
}

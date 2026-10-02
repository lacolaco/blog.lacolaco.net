import { useCallback, useEffect, useRef, useState } from 'react';
import { shareEvents, trackEvent } from '../libs/analytics';
import { checkShareAvailability, shareContent } from '../libs/share';

interface Props {
  title: string;
  url: string;
  locale?: string;
}

const i18n = {
  ja: { share: '共有' },
  en: { share: 'Share' },
};

/**
 * Web Share API による共有ボタン
 * 非対応ブラウザでは何も描画しない（既存のSNS共有リンクのみが残る）
 */
export default function NativeShareButton({ title, url, locale = 'ja' }: Props) {
  const [available, setAvailable] = useState(false);
  /** 共有シートが開いている間の二重呼び出し（navigator.share が InvalidStateError で失敗する）を防ぐ */
  const sharing = useRef(false);

  // navigator は SSR 時に存在しないため、マウント後に機能検出する
  useEffect(() => {
    setAvailable(checkShareAvailability() === 'available');
  }, []);

  const share = useCallback(async () => {
    if (sharing.current) {
      return;
    }
    sharing.current = true;

    const result = await shareContent({ title, url }).finally(() => {
      sharing.current = false;
    });

    switch (result.status) {
      case 'success':
        trackEvent(shareEvents.complete());
        break;
      case 'cancelled':
        trackEvent(shareEvents.cancel());
        break;
      case 'error':
        trackEvent(shareEvents.error(result.message));
        break;
      case 'unavailable':
        // マウント後に利用不可になるケース（機能検出の取りこぼし）ではボタンを隠す
        setAvailable(false);
        break;
    }
  }, [title, url]);

  // onClick は void を返す必要があるため Promise を切り離す
  const handleClick = useCallback(() => {
    void share();
  }, [share]);

  if (!available) {
    return null;
  }

  const t = locale === 'en' ? i18n.en : i18n.ja;

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-gray-300 text-muted hover:text-default hover:bg-gray-100 transition-colors cursor-pointer"
      title={t.share}
      aria-label={t.share}
    >
      <span className="icon-[mdi--share-variant] inline-block text-base" aria-hidden="true" />
    </button>
  );
}

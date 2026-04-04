import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent, summarizerEvents } from '../libs/analytics';
import { checkSummarizerAvailability, summarizeTextStream } from '../libs/summarizer';
import TTSControls from './TTSControls';

type State = 'hidden' | 'ready' | 'loading' | 'result' | 'error';

function ResultPanel({
  variant,
  summary,
  title,
  dismissLabel,
  showTTS,
  locale,
  onDismiss,
}: {
  variant: 'toolbar' | 'default';
  summary: string;
  title: string;
  dismissLabel: string;
  showTTS: boolean;
  locale: string;
  onDismiss: () => void;
}) {
  const isToolbar = variant === 'toolbar';
  return (
    <div
      className={
        isToolbar
          ? 'basis-full mt-2.5 p-3 px-4 bg-surface border border-medium rounded-lg'
          : 'mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg'
      }
    >
      <div className={isToolbar ? 'flex items-center justify-between mb-1.5' : 'flex items-center gap-2 mb-2'}>
        {!isToolbar && <span className="icon-[mdi--sparkles] inline-block w-4 h-4 text-blue-600" />}
        <span className={isToolbar ? 'text-[13px] font-semibold text-secondary' : 'text-sm font-medium text-blue-800'}>
          {title}
        </span>
        {isToolbar && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-xs text-tertiary hover:text-secondary cursor-pointer border-0 bg-transparent p-0"
          >
            {dismissLabel}
          </button>
        )}
      </div>
      <div className={isToolbar ? 'text-sm leading-[1.8] text-body-text m-0' : 'text-sm text-gray-700 leading-relaxed'}>
        {summary}
      </div>
      {showTTS && <TTSControls text={summary} locale={locale} />}
      {!isToolbar && (
        <button
          type="button"
          onClick={onDismiss}
          className="mt-2 text-xs text-muted hover:text-default hover:underline cursor-pointer"
        >
          {dismissLabel}
        </button>
      )}
    </div>
  );
}

function ErrorPanel({
  className,
  message,
  failedLabel,
  retryLabel,
  onRetry,
}: {
  className?: string;
  message: string;
  failedLabel: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div className={['mt-3 p-4 bg-red-50 border border-red-200 rounded-lg', className].filter(Boolean).join(' ')}>
      <div className="flex items-center gap-2 mb-2">
        <span className="icon-[mdi--alert-circle] inline-block w-4 h-4 text-red-600" />
        <span className="text-sm font-medium text-red-800">{failedLabel}</span>
      </div>
      <p className="text-xs text-red-600">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 text-xs text-red-600 hover:text-red-800 hover:underline cursor-pointer"
      >
        {retryLabel}
      </button>
    </div>
  );
}

interface Props {
  locale: string;
  /** PC用ツールバーUIを含めるか（レスポンシブ切替） */
  includeToolbar?: boolean;
}

const i18n = {
  ja: {
    button: 'クリックして要約を生成',
    requiresDownload: '（要ダウンロード）',
    generating: '要約を生成中...',
    title: 'AI要約',
    failed: '要約に失敗しました',
    dismiss: '閉じる',
    retry: '再試行',
  },
  en: {
    button: 'Click to generate summary',
    requiresDownload: '(Requires download)',
    generating: 'Generating summary...',
    title: 'AI Summary',
    failed: 'Summary failed',
    dismiss: 'Dismiss',
    retry: 'Try again',
  },
};

/**
 * 記事本文（Markdown）をDOMから取得する
 */
function getArticleContent(): string {
  const content = document.getElementById('article-markdown')?.textContent;
  if (!content) {
    throw new Error('Article content not found');
  }
  return content;
}

export default function ArticleSummarizer({ locale, includeToolbar = false }: Props) {
  const [state, setState] = useState<State>('hidden');
  const [isDownloadable, setIsDownloadable] = useState(false);
  const [summary, setSummary] = useState('');
  const [isStreamingComplete, setIsStreamingComplete] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const summarizeController = useRef<AbortController | null>(null);
  const isMounted = useRef(true);

  const t = locale === 'en' ? i18n.en : i18n.ja;

  useEffect(() => {
    checkSummarizerAvailability(locale)
      .then((availability) => {
        if (!isMounted.current) return;
        if (availability === 'unsupported' || availability === 'unavailable') {
          return;
        }
        if (availability === 'downloadable' || availability === 'downloading') {
          setIsDownloadable(true);
        }
        setState('ready');
      })
      .catch(() => {
        // Feature detection失敗時は機能を無効化（UIは非表示のまま）
      });

    return () => {
      isMounted.current = false;
      summarizeController.current?.abort();
    };
  }, [locale]);

  const handleSummarize = useCallback(() => {
    // 既存のストリーミングをキャンセル
    summarizeController.current?.abort();
    summarizeController.current = new AbortController();
    const signal = summarizeController.current.signal;

    setState('loading');
    setSummary('');
    setIsStreamingComplete(false);
    trackEvent(summarizerEvents.start());

    const run = async () => {
      const content = getArticleContent();
      let accumulated = '';
      await summarizeTextStream(content, { locale, signal }, (chunk) => {
        // キャンセルまたはアンマウント時は状態更新をスキップ
        if (signal.aborted || !isMounted.current) return;
        accumulated += chunk;
        setSummary(accumulated);
        setState('result');
      });
      // ストリーミング完了
      if (!signal.aborted && isMounted.current) {
        setIsStreamingComplete(true);
        trackEvent(summarizerEvents.complete());
      }
    };

    run().catch((error: unknown) => {
      // キャンセルまたはアンマウント時はエラー処理をスキップ
      if (signal.aborted || !isMounted.current) return;
      const message = error instanceof Error ? error.message : 'Unknown error';
      setErrorMessage(message);
      setState('error');
      trackEvent(summarizerEvents.error(message));
    });
  }, [locale]);

  const dismiss = useCallback(() => setState('ready'), []);

  if (state === 'hidden') {
    return null;
  }

  // ツールバーUI（PC用）
  const toolbarUI = includeToolbar ? (
    <div className="hidden lg:flex lg:flex-wrap lg:items-center lg:gap-0.5 lg:mb-2.5">
      {state === 'ready' && (
        <button
          type="button"
          onClick={handleSummarize}
          className="flex items-center gap-1 text-tertiary px-2 py-1 rounded text-[13px] hover:bg-surface hover:text-secondary cursor-pointer border-0 bg-transparent"
        >
          <span className="icon-[mdi--star] inline-block w-4 h-4" />
          {t.title}
          {isDownloadable && <span className="text-[11px] text-tertiary ml-0.5">{t.requiresDownload}</span>}
        </button>
      )}
      {state === 'loading' && (
        <span className="flex items-center gap-1 text-tertiary px-2 py-1 text-[13px]">
          <span className="icon-[mdi--loading] inline-block w-4 h-4 animate-spin" />
          {t.generating}
        </span>
      )}
      {(state === 'result' || state === 'error') && (
        <button
          type="button"
          onClick={handleSummarize}
          className="flex items-center gap-1 text-tertiary px-2 py-1 rounded text-[13px] hover:bg-surface hover:text-secondary cursor-pointer border-0 bg-transparent"
        >
          <span className="icon-[mdi--star] inline-block w-4 h-4" />
          {t.title}
        </button>
      )}
      {state === 'result' && (
        <ResultPanel
          variant="toolbar"
          summary={summary}
          title={t.title}
          dismissLabel={t.dismiss}
          showTTS={isStreamingComplete}
          locale={locale}
          onDismiss={dismiss}
        />
      )}
      {state === 'error' && (
        <ErrorPanel
          className="basis-full"
          message={errorMessage}
          failedLabel={t.failed}
          retryLabel={t.retry}
          onRetry={handleSummarize}
        />
      )}
    </div>
  ) : null;

  // デフォルトUI（モバイル用）
  const defaultUI = (
    <div className={includeToolbar ? 'mt-2 lg:hidden' : 'mt-2'}>
      {state === 'ready' && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={handleSummarize}
            className="inline-flex items-center gap-x-1 px-3 py-2 text-xs text-blue-600 border border-blue-300 rounded-full hover:bg-blue-50 hover:border-blue-400 cursor-pointer transition-colors"
          >
            <span className="icon-[mdi--sparkles] inline-block w-3 h-3" />
            {t.button}
          </button>
          {isDownloadable && <span className="text-xs text-muted ml-2">{t.requiresDownload}</span>}
        </div>
      )}
      {state === 'loading' && (
        <div className="flex items-center">
          <span className="inline-flex items-center gap-x-1 px-3 py-2 text-xs text-blue-600 border border-blue-300 rounded-full">
            <span className="icon-[mdi--loading] inline-block w-3 h-3 animate-spin" />
            {t.generating}
          </span>
        </div>
      )}
      {state === 'result' && (
        <ResultPanel
          variant="default"
          summary={summary}
          title={t.title}
          dismissLabel={t.dismiss}
          showTTS={isStreamingComplete}
          locale={locale}
          onDismiss={dismiss}
        />
      )}
      {state === 'error' && (
        <ErrorPanel message={errorMessage} failedLabel={t.failed} retryLabel={t.retry} onRetry={handleSummarize} />
      )}
    </div>
  );

  return (
    <>
      {toolbarUI}
      {defaultUI}
    </>
  );
}

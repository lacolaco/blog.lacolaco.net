import { useCallback, useEffect, useRef, useState } from 'react';
import { checkSummarizerAvailability, summarizeTextStream } from '../libs/summarizer';

type State = 'hidden' | 'ready' | 'loading' | 'result' | 'error';

interface Props {
  locale: string;
  content: string;
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

export default function ArticleSummarizer({ locale, content }: Props) {
  const [state, setState] = useState<State>('hidden');
  const [isDownloadable, setIsDownloadable] = useState(false);
  const [summary, setSummary] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const summarizeController = useRef<AbortController | null>(null);
  const isMounted = useRef(true);

  const t = locale === 'en' ? i18n.en : i18n.ja;

  useEffect(() => {
    checkSummarizerAvailability()
      .then((availability) => {
        if (!isMounted.current) return;
        if (availability === 'unsupported' || availability === 'unavailable') {
          return;
        }
        if (availability === 'downloadable') {
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
  }, []);

  const handleSummarize = useCallback(() => {
    // 既存のストリーミングをキャンセル
    summarizeController.current?.abort();
    summarizeController.current = new AbortController();
    const signal = summarizeController.current.signal;

    setState('loading');
    setSummary('');

    const run = async () => {
      if (!content.trim()) {
        throw new Error('Article content not found');
      }

      let accumulated = '';
      await summarizeTextStream(content, { locale, signal }, (chunk) => {
        // キャンセルまたはアンマウント時は状態更新をスキップ
        if (signal.aborted || !isMounted.current) return;
        accumulated += chunk;
        setSummary(accumulated);
        setState('result');
      });
    };

    run().catch((error: unknown) => {
      // キャンセルまたはアンマウント時はエラー処理をスキップ
      if (signal.aborted || !isMounted.current) return;
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
      setState('error');
    });
  }, [content, locale]);

  if (state === 'hidden') {
    return null;
  }

  return (
    <div className="mt-2">
      {/* ボタン */}
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

      {/* ローディング */}
      {state === 'loading' && (
        <div className="flex items-center gap-2">
          <span className="icon-[mdi--loading] inline-block w-4 h-4 animate-spin" />
          <span className="text-sm text-muted">{t.generating}</span>
        </div>
      )}

      {/* 結果 */}
      {state === 'result' && (
        <div className="mt-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-[mdi--sparkles] inline-block w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">{t.title}</span>
          </div>
          <div className="text-sm text-gray-700 leading-relaxed">{summary}</div>
          <button
            type="button"
            onClick={() => setState('ready')}
            className="mt-2 text-xs text-muted hover:text-default hover:underline cursor-pointer"
          >
            {t.dismiss}
          </button>
        </div>
      )}

      {/* エラー */}
      {state === 'error' && (
        <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="icon-[mdi--alert-circle] inline-block w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">{t.failed}</span>
          </div>
          <p className="text-xs text-red-600">{errorMessage}</p>
          <button
            type="button"
            onClick={handleSummarize}
            className="mt-2 text-xs text-red-600 hover:text-red-800 hover:underline cursor-pointer"
          >
            {t.retry}
          </button>
        </div>
      )}
    </div>
  );
}

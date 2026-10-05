import type { HighlightRange } from './highlight';

/** 検索 API (tools/search-worker) の 1 件分の応答。`highlights` は `snippet` の中の一致範囲 */
export type SearchHit = {
  slug: string;
  title: string;
  date: string;
  channels: string[];
  snippet: string;
  highlights: HighlightRange[];
};

/** 範囲が整数の組で、抜粋の内側にあり、昇順で重ならない。DOM を組む側が検査なしで slice できるようにする */
const isHighlights = (x: unknown, length: number): x is HighlightRange[] => {
  if (!Array.isArray(x)) return false;
  let last = 0;
  for (const r of x as unknown[]) {
    if (!Array.isArray(r) || r.length !== 2) return false;
    const [start, end] = r as [unknown, unknown];
    if (!Number.isInteger(start) || !Number.isInteger(end)) return false;
    if (typeof start !== 'number' || typeof end !== 'number') return false;
    if (start < last || end <= start || end > length) return false;
    last = end;
  }
  return true;
};

export type SearchOutcome = { status: 'ok'; hits: SearchHit[] } | { status: 'stale' } | { status: 'error' };

type Fetcher = (url: string, init?: RequestInit) => Promise<Response>;

const isHit = (x: unknown): x is SearchHit => {
  if (typeof x !== 'object' || x === null) return false;
  const r = x as Record<string, unknown>;
  return (
    typeof r.slug === 'string' &&
    typeof r.title === 'string' &&
    typeof r.date === 'string' &&
    typeof r.snippet === 'string' &&
    isHighlights(r.highlights, r.snippet.length) &&
    Array.isArray(r.channels) &&
    r.channels.every((c) => typeof c === 'string')
  );
};

/**
 * 最新の要求だけを有効にする検索。新しい要求で古い要求を中断し、
 * 中断が間に合わず遅れて届いた古い応答も番号で見分けて stale にする。
 * 失敗 (HTTP エラー・通信失敗・形の違う応答) は error で返し、0 件とは区別する。
 */
export function createLatestSearch(fetcher: Fetcher = (url, init) => fetch(url, init)) {
  let seq = 0;
  let controller: AbortController | undefined;

  const search = async (url: string): Promise<SearchOutcome> => {
    controller?.abort();
    const mine = ++seq;
    const ctrl = new AbortController();
    controller = ctrl;
    try {
      const res = await fetcher(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
      if (!res.ok) return mine === seq ? { status: 'error' } : { status: 'stale' };
      const body: unknown = await res.json();
      // 応答を待つ間に次の要求が出ていたら、中断の成否によらず捨てる
      if (mine !== seq) return { status: 'stale' };
      if (!Array.isArray(body) || !body.every(isHit)) return { status: 'error' };
      return { status: 'ok', hits: body };
    } catch {
      return mine === seq && !ctrl.signal.aborted ? { status: 'error' } : { status: 'stale' };
    }
  };

  /** 進行中の要求を中断し、その応答を捨てる (モーダルを閉じたときや入力が空になったとき) */
  search.cancel = () => {
    seq++;
    controller?.abort();
  };

  return search;
}

import { describe, expect, it } from 'vitest';
import { createLatestSearch, type SearchHit } from './latest-search';

const hit = (slug: string): SearchHit => ({ slug, title: slug, date: '2026-01-01', channels: [], snippet: '' });

/** 外から応答の返し方を決められる fetch の代役。中断の信号は無視する (中断に頼らず古い応答を捨てることを確かめるため) */
function controlledFetch() {
  const pending: { url: string; signal?: AbortSignal; resolve: (r: Response) => void }[] = [];
  const fetcher = (url: string, init?: RequestInit) =>
    new Promise<Response>((resolve) => pending.push({ url, signal: init?.signal ?? undefined, resolve }));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  return { fetcher, pending, json };
}

describe('createLatestSearch', () => {
  it('応答を返す', async () => {
    const { fetcher, pending, json } = controlledFetch();
    const search = createLatestSearch(fetcher);
    const p = search('/x?q=a');
    pending[0].resolve(json([hit('a')]));
    expect(await p).toEqual({ status: 'ok', hits: [hit('a')] });
  });

  it('遅れて届いた古い応答は捨て、新しい結果を上書きしない', async () => {
    const { fetcher, pending, json } = controlledFetch();
    const search = createLatestSearch(fetcher);
    const first = search('/x?q=a');
    const second = search('/x?q=ab');
    pending[1].resolve(json([hit('new')]));
    expect(await second).toEqual({ status: 'ok', hits: [hit('new')] });
    pending[0].resolve(json([hit('old')]));
    expect(await first).toEqual({ status: 'stale' });
  });

  it('新しい要求を出すと古い要求を中断する', () => {
    const { fetcher, pending } = controlledFetch();
    const search = createLatestSearch(fetcher);
    void search('/x?q=a');
    void search('/x?q=ab');
    expect(pending[0].signal?.aborted).toBe(true);
    expect(pending[1].signal?.aborted).toBe(false);
  });

  it('HTTP エラーは error にする (0 件にしない)', async () => {
    const { fetcher, pending, json } = controlledFetch();
    const search = createLatestSearch(fetcher);
    const p = search('/x?q=a');
    pending[0].resolve(json({ error: 'x' }, 500));
    expect(await p).toEqual({ status: 'error' });
  });

  it('通信の失敗は error にする', async () => {
    const search = createLatestSearch(() => Promise.reject(new TypeError('network')));
    expect(await search('/x?q=a')).toEqual({ status: 'error' });
  });

  it('形の違う応答は error にする', async () => {
    const { fetcher, pending, json } = controlledFetch();
    const search = createLatestSearch(fetcher);
    const p = search('/x?q=a');
    pending[0].resolve(json({ hits: [] }));
    expect(await p).toEqual({ status: 'error' });
  });

  it('中断された要求は stale で、error にしない', async () => {
    const search = createLatestSearch((_url, init) => {
      return new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
      });
    });
    const first = search('/x?q=a');
    void search('/x?q=ab');
    expect(await first).toEqual({ status: 'stale' });
  });

  it('cancel すると進行中の要求を stale にする', async () => {
    const { fetcher, pending, json } = controlledFetch();
    const search = createLatestSearch(fetcher);
    const p = search('/x?q=a');
    search.cancel();
    pending[0].resolve(json([hit('a')]));
    expect(await p).toEqual({ status: 'stale' });
  });
});

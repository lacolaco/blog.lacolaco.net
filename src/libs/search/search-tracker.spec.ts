import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_IDLE_MS, createSearchReporter } from './search-tracker';

describe('createSearchReporter', () => {
  const sent: string[] = [];
  const make = () => createSearchReporter((term) => sent.push(term));

  beforeEach(() => {
    sent.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('結果を出してから SEARCH_IDLE_MS の直前までは送らず、その時点で 1 回送る', () => {
    const r = make();
    r.input();
    r.resultShown('angular');
    vi.advanceTimersByTime(SEARCH_IDLE_MS - 1);
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(sent).toEqual(['angular']);
    vi.advanceTimersByTime(SEARCH_IDLE_MS * 3);
    expect(sent).toEqual(['angular']);
  });

  it('表示の待ちより遅い入力 (300ms 間隔) でも、途中の語を送らず最後の語だけ送る', () => {
    const r = make();
    for (const term of ['a', 'an', 'ang', 'angu', 'angul', 'angula', 'angular']) {
      r.input();
      vi.advanceTimersByTime(200);
      r.resultShown(term);
      vi.advanceTimersByTime(100);
    }
    expect(sent).toEqual([]);
    vi.advanceTimersByTime(SEARCH_IDLE_MS);
    expect(sent).toEqual(['angular']);
  });

  it('入力のたびに待ちをやり直す', () => {
    const r = make();
    r.resultShown('ang');
    vi.advanceTimersByTime(SEARCH_IDLE_MS - 1);
    r.input();
    vi.advanceTimersByTime(SEARCH_IDLE_MS - 1);
    expect(sent).toEqual([]);
  });

  it('結果が出る前に待ちが過ぎても、前の語は送らない', () => {
    const r = make();
    r.resultShown('ang');
    r.input();
    vi.advanceTimersByTime(SEARCH_IDLE_MS * 2);
    expect(sent).toEqual([]);
  });

  it('flush で待たずに送る。送ったあとの待ちは何も送らない', () => {
    const r = make();
    r.resultShown('angular');
    r.flush();
    expect(sent).toEqual(['angular']);
    vi.advanceTimersByTime(SEARCH_IDLE_MS * 2);
    r.flush();
    expect(sent).toEqual(['angular']);
  });

  it('commit は入力の途中でも、表示中の結果の語を待たずに送る', () => {
    const r = make();
    r.resultShown('ang');
    r.input();
    r.commit('ang');
    expect(sent).toEqual(['ang']);
  });

  it('送るものが無ければ flush は何もしない', () => {
    make().flush();
    expect(sent).toEqual([]);
  });

  it('前後の空白だけ違う同じ語は続けて送らない', () => {
    const r = make();
    r.resultShown('angular');
    r.flush();
    r.resultShown(' angular ');
    r.flush();
    expect(sent).toEqual(['angular']);
  });

  it('語が変われば送る。直前の語に戻っても送る', () => {
    const r = make();
    for (const t of ['a', 'b', 'a']) {
      r.resultShown(t);
      r.flush();
    }
    expect(sent).toEqual(['a', 'b', 'a']);
  });

  it('空にすると送る予定を捨て、直前の語を忘れる', () => {
    const r = make();
    r.resultShown('a');
    r.reset();
    vi.advanceTimersByTime(SEARCH_IDLE_MS * 2);
    expect(sent).toEqual([]);
    r.resultShown('a');
    r.flush();
    r.reset();
    r.resultShown('a');
    r.flush();
    expect(sent).toEqual(['a', 'a']);
  });

  it('reset (ダイアログを開くとき) で送る予定を捨て、同じ語をまた数える', () => {
    const r = make();
    r.resultShown('angular');
    r.flush();
    r.reset();
    r.resultShown('angular');
    r.flush();
    expect(sent).toEqual(['angular', 'angular']);
    r.resultShown('x');
    r.reset();
    vi.advanceTimersByTime(SEARCH_IDLE_MS * 2);
    expect(sent).toEqual(['angular', 'angular']);
  });
});

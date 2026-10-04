import { describe, expect, it } from 'vitest';
import { highlightSegments, queryTerms } from './highlight';

describe('queryTerms', () => {
  it('空白で区切って空要素を除く', () => {
    expect(queryTerms('  遅延  読み込み ')).toEqual(['遅延', '読み込み']);
  });
  it('空や空白だけなら空配列', () => {
    expect(queryTerms('')).toEqual([]);
    expect(queryTerms(' 　 ')).toEqual([]);
  });
});

describe('highlightSegments', () => {
  it('検索語が無ければ全体を強調なしの1片にする', () => {
    expect(highlightSegments('本文です', [])).toEqual([{ text: '本文です', match: false }]);
  });
  it('一致しなければ全体を強調なしの1片にする', () => {
    expect(highlightSegments('本文です', ['zzz'])).toEqual([{ text: '本文です', match: false }]);
  });
  it('複数の一致を強調する', () => {
    expect(highlightSegments('遅延読み込みと遅延評価', ['遅延'])).toEqual([
      { text: '遅延', match: true },
      { text: '読み込みと', match: false },
      { text: '遅延', match: true },
      { text: '評価', match: false },
    ]);
  });
  it('複数の語を強調し、大文字小文字は本文の表記を保つ', () => {
    expect(highlightSegments('Lazy Loading', ['lazy', 'LOADING'])).toEqual([
      { text: 'Lazy', match: true },
      { text: ' ', match: false },
      { text: 'Loading', match: true },
    ]);
  });
  it('全角と半角の表記ゆれは NFKC で一致させる', () => {
    expect(highlightSegments('ＡＢＣ def', ['abc'])).toEqual([
      { text: 'ＡＢＣ', match: true },
      { text: ' def', match: false },
    ]);
  });
  it('HTML の特殊文字や正規表現の記号は、そのまま文字として扱う', () => {
    const text = '<img src=x onerror=alert(1)> a.b (c) & "d"';
    expect(highlightSegments(text, [])).toEqual([{ text, match: false }]);
    expect(highlightSegments(text, ['<img', 'a.b', '(c)'])).toEqual([
      { text: '<img', match: true },
      { text: ' src=x onerror=alert(1)> ', match: false },
      { text: 'a.b', match: true },
      { text: ' ', match: false },
      { text: '(c)', match: true },
      { text: ' & "d"', match: false },
    ]);
  });
  it('片を連結すると元の文字列に戻る', () => {
    const text = '…injectAsync は <b>遅延</b> します…';
    const joined = highlightSegments(text, ['injectasync', '遅延', 'b'])
      .map((s) => s.text)
      .join('');
    expect(joined).toBe(text);
  });
});

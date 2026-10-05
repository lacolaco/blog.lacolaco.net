// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHighlighted } from './highlight';

/** 断片を、強調された片を [] で囲んだ文字列にして比べる */
function shape(frag: DocumentFragment): string {
  return Array.from(frag.childNodes)
    .map((n) => (n instanceof Element ? `[${n.tagName.toLowerCase()}:${n.textContent}]` : n.textContent))
    .join('');
}

describe('renderHighlighted', () => {
  it('範囲が無ければ全体を強調なしの文字列にする', () => {
    const frag = renderHighlighted('本文です', []);
    expect(frag.querySelector('mark')).toBeNull();
    expect(frag.textContent).toBe('本文です');
  });
  it('1 つの範囲を mark にする', () => {
    expect(shape(renderHighlighted('遅延読み込み', [[0, 2]]))).toBe('[mark:遅延]読み込み');
  });
  it('複数の範囲を mark にし、間の文字列を保つ', () => {
    expect(
      shape(
        renderHighlighted('遅延読み込みと遅延評価', [
          [0, 2],
          [7, 9],
        ]),
      ),
    ).toBe('[mark:遅延]読み込みと[mark:遅延]評価');
  });
  it('先頭と末尾の端まで届く範囲でも空の文字列を作らない', () => {
    const frag = renderHighlighted('abc', [[0, 3]]);
    expect(frag.childNodes).toHaveLength(1);
    expect(shape(frag)).toBe('[mark:abc]');
  });
  it('サロゲートペアは UTF-16 の位置で切り、文字を壊さない', () => {
    // 𠮷 は UTF-16 で 2 単位 (位置 1 と 2)
    const text = 'あ𠮷a';
    expect(shape(renderHighlighted(text, [[1, 3]]))).toBe('あ[mark:𠮷]a');
    expect(shape(renderHighlighted(text, [[3, 4]]))).toBe('あ𠮷[mark:a]');
  });
  it('HTML の特殊文字は要素にならず文字として出る', () => {
    const text = '<img src=x onerror=alert(1)> & "d"';
    const frag = renderHighlighted(text, [[0, 4]]);
    expect(frag.querySelector('img')).toBeNull();
    expect(Array.from(frag.children).map((e) => e.tagName)).toEqual(['MARK']);
    expect(frag.querySelector('mark')!.textContent).toBe('<img');
    expect(frag.textContent).toBe(text);
  });
  it('片を連結すると元の文字列に戻る', () => {
    const text = '…injectAsync は <b>遅延</b> します…';
    const frag = renderHighlighted(text, [
      [1, 12],
      [18, 20],
    ]);
    expect(frag.textContent).toBe(text);
    expect(Array.from(frag.querySelectorAll('mark')).map((m) => m.textContent)).toEqual(['injectAsync', '遅延']);
  });
});

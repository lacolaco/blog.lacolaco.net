/** 検索 API が返す、抜粋の中の一致範囲。UTF-16 の位置の組 [start, end) で、昇順かつ互いに重ならない */
export type HighlightRange = readonly [start: number, end: number];

/**
 * 抜粋を、API が返した一致範囲で分けて <mark> で包んだ DOM 断片にする。
 * 一致箇所は API の `highlights` に従い、クライアントでは求めない。
 * HTML 文字列を作らず、すべて text として入れるので、本文中の記号は解釈されない。
 */
export function renderHighlighted(
  text: string,
  ranges: readonly HighlightRange[],
  doc: Document = document,
): DocumentFragment {
  const frag = doc.createDocumentFragment();
  let last = 0;
  for (const [start, end] of ranges) {
    if (start > last) frag.append(text.slice(last, start));
    const mark = doc.createElement('mark');
    mark.textContent = text.slice(start, end);
    frag.append(mark);
    last = end;
  }
  if (last < text.length) frag.append(text.slice(last));
  return frag;
}

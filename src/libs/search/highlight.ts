export type Segment = { text: string; match: boolean };

const fold = (s: string) => s.normalize('NFKC').toLowerCase();

/** 検索語を空白 (全角を含む) で区切る。空や空白だけなら空配列 */
export function queryTerms(q: string): string[] {
  return q.split(/\s+/u).filter(Boolean);
}

/**
 * 抜粋や題名を、検索語に一致する片とそれ以外の片に分ける。
 * API は強調の印を返さないので、クライアントで検索語から一致箇所を求める。
 * 文字列の分割だけを行い HTML や正規表現を作らないため、本文中の記号は常にそのまま文字として扱われる。
 * 検索 API は NFKC 正規化と大文字小文字の無視で一致させるので、同じ規則で比べ、表示は本文の表記を保つ。
 */
export function highlightSegments(text: string, terms: string[]): Segment[] {
  const needles = [...new Set(terms.map(fold).filter(Boolean))].sort((a, b) => b.length - a.length);
  if (needles.length === 0) return [{ text, match: false }];

  // 正規化で文字数が変わっても元の位置へ戻せるよう、1 文字ずつ畳んで、畳んだ文字ごとの元の開始位置を持つ
  let folded = '';
  const origin: number[] = [];
  let pos = 0;
  for (const ch of text) {
    const f = fold(ch);
    for (let i = 0; i < f.length; i++) origin.push(pos);
    folded += f;
    pos += ch.length;
  }
  origin.push(text.length);

  const segments: Segment[] = [];
  let last = 0;
  let i = 0;
  while (i < folded.length) {
    const needle = needles.find((n) => folded.startsWith(n, i));
    if (!needle) {
      i++;
      continue;
    }
    const start = origin[i];
    // 一致の終端が元の 1 文字の途中なら、その文字の終わりまで含める
    let endIdx = i + needle.length;
    while (endIdx < folded.length && origin[endIdx] === origin[endIdx - 1]) endIdx++;
    const end = origin[endIdx];
    if (start >= last) {
      if (start > last) segments.push({ text: text.slice(last, start), match: false });
      segments.push({ text: text.slice(start, end), match: true });
      last = end;
    }
    i = endIdx;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments.length > 0 ? segments : [{ text, match: false }];
}

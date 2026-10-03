/**
 * markdown を平文化する。コードブロックは中身を残し、フェンス行だけ除く
 * (技術ブログでは API 名がコード内にしか出ない記事があるため)。
 * 評価ハーネスの build-corpus.ts の toPlain と同一の規則。
 */
export function toPlain(md: string): string {
  const out: string[] = [];
  let inFence = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      out.push(line);
      continue;
    }
    let l = line;
    if (/^\s*https?:\/\/\S+\s*$/.test(l)) continue; // 単独 URL 行 (埋め込み) は捨てる
    l = l.replace(/!\[[^\]]*\]\([^)]*\)/g, ''); // 画像
    l = l.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1'); // リンクは文言だけ
    l = l.replace(/<[^>\n]+>/g, ''); // HTML タグ
    l = l
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*>\s?/, '')
      .replace(/^\s*([-*+]|\d+\.)\s+/, '');
    l = l.replace(/(\*\*|__|~~)/g, '').replace(/`/g, '');
    out.push(l);
  }
  return out
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

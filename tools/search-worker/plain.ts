// 記事の Markdown 本文を検索用の平文にする。規則は評価ハーネス (corpus 生成の toPlain) と同一で、
// 評価した品質を保つために変えない。
// - コードブロックはフェンス行だけ除き中身を残す。技術ブログでは API 名がコード内にしか出ない記事があるため
// - 単独行の URL (埋め込みリンク) と画像は捨て、リンクは文言だけ残す
// - HTML タグ、見出し・引用・リスト・強調の記号、インラインコードのバッククォートを外す
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
    if (/^\s*https?:\/\/\S+\s*$/.test(l)) continue;
    l = l.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
    l = l.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    l = l.replace(/<[^>\n]+>/g, '');
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

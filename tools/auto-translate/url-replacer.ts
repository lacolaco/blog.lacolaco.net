// 翻訳後の en body に対して、日本語向けサイト URL を英語版 URL に置換する後処理。
// 置換は決定的かつ冪等なので、キャッシュヒット経路にも適用でき、ルールの追加・変更が
// LLM 再翻訳なしにキャッシュ済み記事へ波及する（PROMPT_VERSION の bump 不要）。

import { remark } from 'remark';
import remarkGfm from 'remark-gfm';
import { visitParents } from 'unist-util-visit-parents';

const remarkProcessor = remark().use(remarkGfm);

// 1 ルール = 1 replacer。マッチしなければ null を返す。
// 制約: 置換結果はどの replacer にも再マッチしないこと（冪等性）。破ると
// キャッシュヒット経路で毎回 body が書き換わり skipped 判定が成立しなくなる
export interface UrlReplacer {
  name: string;
  replace(url: string): string | null;
}

function tryParse(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

// URL#toString() で再構築すると正規化（例: https://angular.jp → https://angular.dev/）で
// 原文と乖離するため、マッチ判定のみ URL パースで行い、置換は正規表現による文字列操作で行う

// ホスト部はドメイン名が大文字小文字を区別しないため i フラグでマッチさせる
// （hostname 判定は WHATWG URL の正規化で常に小文字になるのに対し、置換は原文文字列に
// 対して行うため、フラグがないと大文字混じりドメインが置換から漏れる）。
// 置換結果のホストは正規形（小文字）で出力する

export const angularJpReplacer: UrlReplacer = {
  name: 'angular.jp',
  replace(url) {
    if (tryParse(url)?.hostname !== 'angular.jp') return null;
    return url.replace(/^(https?:\/\/)angular\.jp(?=[/:?#]|$)/i, '$1angular.dev');
  },
};

// MDN のロケールはパス第 1 セグメント。/ja/<path> → /en-US/<path> はスラッグが
// ロケール間で同一（mdn/translated-content の規約で slug 一致必須）なため常に有効。
// en-US は正規形表記（/en-us/ は MDN 側で 301 正規化されるが、生成 URL は正規形を使う）
export const mdnJaReplacer: UrlReplacer = {
  name: 'mdn-ja',
  replace(url) {
    const parsed = tryParse(url);
    if (parsed?.hostname !== 'developer.mozilla.org') return null;
    if (parsed.pathname !== '/ja' && !parsed.pathname.startsWith('/ja/')) return null;
    return url.replace(/^(https?:\/\/)developer\.mozilla\.org\/ja(?=[/?#]|$)/i, '$1developer.mozilla.org/en-US');
  },
};

export const defaultUrlReplacers: UrlReplacer[] = [angularJpReplacer, mdnJaReplacer];

function applyReplacers(url: string, replacers: UrlReplacer[]): string | null {
  for (const replacer of replacers) {
    const replaced = replacer.replace(url);
    // 無変更の戻り値は no-match 扱いにする: hostname 判定は通るが置換 regex が
    // 不一致になる URL（userinfo・ポート付き等）で replacer が元の URL をそのまま
    // 返しても、契約（マッチしなければ null）違反が下流へ波及しないよう防御する
    if (replaced !== null && replaced !== url) return replaced;
  }
  return null;
}

// markdown 中の link / definition ノードの URL を走査し、最初にマッチした replacer で置換する。
// code / inlineCode は link ノードにならないため自然に対象外（コード中の URL は書き換えない）。
// blockquote 内のリンクは置換対象に含める（引用中でも読者を英語版ページへ誘導するのが目的のため）
export function replaceUrls(markdown: string, replacers: UrlReplacer[] = defaultUrlReplacers): string {
  const tree = remarkProcessor.parse(markdown);
  const edits: { start: number; end: number; replacement: string }[] = [];

  visitParents(tree, (node) => {
    if (node.type !== 'link' && node.type !== 'definition') return;
    const newUrl = applyReplacers(node.url, replacers);
    if (newUrl === null) return;
    const pos = node.position;
    if (pos == null) return;
    const start = pos.start.offset;
    const end = pos.end.offset;
    if (start == null || end == null) return;

    // ノードの source slice 内で旧 URL の全出現を置換する。
    // bare autolink はリンクテキスト = URL なので href とテキストの両方が置き換わる。
    // mdast の url がソース表記と一致しない場合（エンティティ参照等）は fail-safe でスキップ
    const slice = markdown.slice(start, end);
    if (!slice.includes(node.url)) return;
    edits.push({ start, end, replacement: slice.split(node.url).join(newUrl) });
  });

  // 右から左へ置換することでオフセットがズレないようにする
  edits.sort((a, b) => b.start - a.start);
  let result = markdown;
  for (const e of edits) {
    result = result.slice(0, e.start) + e.replacement + result.slice(e.end);
  }
  return result;
}

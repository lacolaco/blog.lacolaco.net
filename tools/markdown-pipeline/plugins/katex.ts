import katex from 'katex';
import { defineMdastPlugin } from 'satteri';

function render(value: string, displayMode: boolean): string {
  try {
    return katex.renderToString(value, { displayMode, throwOnError: true });
  } catch {
    // 構文エラーは KaTeX のエラー表示で出し、記事のビルドは止めない
    return katex.renderToString(value, { displayMode, strict: 'ignore', throwOnError: false });
  }
}

/** remark-math + rehype-katex 相当。数式のノードと ```math を KaTeX の HTML にする */
export const satteriKatex = defineMdastPlugin({
  name: 'katex',
  math: (node) => ({ type: 'html', value: render(node.value, true) }),
  inlineMath: (node) => ({ type: 'html', value: render(node.value, false) }),
  code(node) {
    // コードブロックの値は hast に渡るとき末尾に改行が付く。移行前の入力に合わせる
    if (node.lang === 'math') return { type: 'html', value: render(`${node.value}\n`, true) };
  },
});

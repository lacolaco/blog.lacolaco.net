import escapeHtml from 'escape-html';
import { defineMdastPlugin } from 'satteri';

/** rehype-mermaid の strategy: 'pre-mermaid' 相当。クライアントで描画するため、図の定義をそのまま pre.mermaid に入れる */
export const satteriMermaid = defineMdastPlugin({
  name: 'mermaid',
  code(node) {
    // 末尾の改行は hast に渡るときに付くもので、移行前の出力に含まれている
    if (node.lang === 'mermaid')
      return { type: 'html', value: `<pre class="mermaid">${escapeHtml(`${node.value}\n`)}</pre>` };
  },
});

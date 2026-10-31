import type { Element } from 'hast';
import { createHighlighter, isSpecialLang } from 'shiki';
import { defineHastPlugin } from 'satteri';

// noUncheckedIndexedAccess が無いため、範囲外を読む箇所は undefined を含む型で受ける
const at = <T>(items: readonly T[], index: number): T | undefined => items[index];

const LANGUAGE_PATTERN = /\blanguage-(\S+)/;
const THEME = 'github-light';

type Highlighter = Awaited<ReturnType<typeof createHighlighter>>;

let highlighterPromise: Promise<Highlighter> | undefined;

// 言語は使われたときに読み込む。読み込み済みの言語は markdown ブロックの埋め込み言語としても効くため、読み込みの順序が出力に出る
async function highlight(code: string, requestedLang: string): Promise<Element | undefined> {
  highlighterPromise ??= createHighlighter({ themes: [THEME], langs: ['plaintext'] });
  const highlighter = await highlighterPromise;

  let lang = requestedLang;
  if (!isSpecialLang(lang) && !highlighter.getLoadedLanguages().includes(lang)) {
    try {
      await highlighter.loadLanguage(lang as never);
    } catch {
      console.warn(`[Shiki] The language "${lang}" doesn't exist, falling back to "plaintext".`);
      lang = 'plaintext';
    }
  }

  const root = highlighter.codeToHast(
    // 末尾の改行は1つだけ落とす。unified の処理系の色付けと同じで、空行で終わるコードの最後の行を残すため
    code.replace(/(?:\r\n|\r|\n)$/, ''),
    {
      lang,
      theme: THEME,
      transformers: [
        {
          pre(node) {
            const className = Array.isArray(node.properties.class)
              ? node.properties.class.join(' ')
              : node.properties.class;
            node.properties.class = String(className ?? '').replace(/shiki/g, 'astro-code');
            node.properties.style = `${String(node.properties.style ?? '')}; overflow-x: auto;`;
            node.properties.dataLanguage = lang;
          },
          // diff の +/- は選択対象から外す
          line(node) {
            if (lang !== 'diff') return;
            const inner = at(node.children, 0);
            const text = inner?.type === 'element' ? at(inner.children, 0) : undefined;
            if (inner?.type !== 'element' || text?.type !== 'text') return;
            const start = text.value[0];
            if (start === '+' || start === '-') {
              text.value = text.value.slice(1);
              inner.children.unshift({
                type: 'element',
                tagName: 'span',
                properties: { style: 'user-select: none;' },
                children: [{ type: 'text', value: start }],
              });
            }
          },
        },
      ],
    },
  );
  const pre = at(root.children, 0);
  return pre?.type === 'element' ? pre : undefined;
}

/**
 * コードブロックを shiki で色付けする。出力は unified の処理系 (Astro 標準の rehype-shiki) に合わせてある。
 * Sätteri は非同期の visitor を並行に走らせるため、文書ごとに待ち行列を持って1ブロックずつ処理する
 */
export const satteriHighlight = () => {
  return () => {
    let queue: Promise<unknown> = Promise.resolve();

    return defineHastPlugin({
      name: 'highlight',
      element: {
        filter: ['pre'],
        async visit(node, ctx) {
          // `<code>` が唯一の子である pre だけが対象
          const code = node.children.length === 1 ? node.children[0] : undefined;
          if (code?.type !== 'element' || code.tagName !== 'code') return;

          const classNames = code.properties.className;
          const languageClass = Array.isArray(classNames)
            ? classNames.find((name) => typeof name === 'string' && LANGUAGE_PATTERN.test(name))
            : undefined;
          const language =
            (typeof languageClass === 'string' && LANGUAGE_PATTERN.exec(languageClass)?.[1]) || 'plaintext';

          const text = ctx.textContent(code);
          const result = queue.then(() => highlight(text, language));
          queue = result.catch(() => undefined);
          const replacement = await result;
          if (replacement) ctx.replaceNode(node, replacement);
        },
      },
    });
  };
};

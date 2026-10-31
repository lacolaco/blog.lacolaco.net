import type { Root } from 'hast';
import type { Raw } from 'mdast-util-to-hast';
import type { Plugin, Processor } from 'unified';
import { visit } from 'unist-util-visit';

// テキストの @ を文字参照で出力する。配信時に Cloudflare の Email Obfuscation が
// `user@host` (Misskey のユーザー名、コード中の文字列など) をメールアドレスとして書き換えるのを防ぐ。
//
// Astro の unified() はユーザーの rehype プラグインの後に rehype-raw と rehype-stringify を必ず実行する。
// rehype-raw は生 HTML の文字参照を文字に戻し、rehype-stringify はテキストの < と & しかエスケープしない。
// そこで rehype-raw より後に実行される transformer を追加し、@ を含むテキストを
// エスケープ済みの raw ノードに置き換える (raw は allowDangerousHtml により文字列のまま出力される)。
function escapeText(value: string): string {
  return value.replace(/&/g, '&#x26;').replace(/</g, '&#x3C;').replace(/@/g, '&#x40;');
}

const transformer = () => (tree: Root) => {
  visit(tree, 'text', (node, index, parent) => {
    if (!parent || index === undefined || !node.value.includes('@')) return;
    // script と style の中身は rehype-stringify もエスケープしない
    if (parent.type === 'element' && (parent.tagName === 'script' || parent.tagName === 'style')) return;
    const raw: Raw = { type: 'raw', value: escapeText(node.value) };
    parent.children[index] = raw;
  });
};

const rehypeEscapeAt: Plugin<[], Root> = function (this: Processor) {
  // attacher は freeze 中に呼ばれ、ここで use した transformer は既に登録済みの rehype-raw より後に実行される
  this.use(transformer);
};

export default rehypeEscapeAt;

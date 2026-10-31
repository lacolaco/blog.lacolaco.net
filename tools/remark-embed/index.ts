import type { Html, Paragraph, Root } from 'mdast';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { createEmbedResolver, type RemarkEmbedOptions } from './resolve.ts';

const remarkEmbed: Plugin<[RemarkEmbedOptions?], Root> = (options = {}) => {
  const resolveEmbed = createEmbedResolver(options);

  return async (tree: Root, file) => {
    const source = String(file.value);

    const promises: Promise<void>[] = [];

    visit(tree, 'paragraph', (node: Paragraph, index, parent) => {
      // 親がルートノードでない場合は処理しない
      if (!parent || parent.type !== 'root') {
        return;
      }

      // リンク形式のパラグラフをチェック
      if (node.children.length !== 1 || node.children[0].type !== 'link') {
        return; // リンクが1つだけでない場合は何もしない
      }

      const link = node.children[0];
      const { start, end } = link.position ?? {};
      const embed = resolveEmbed({
        url: link.url,
        text: link.children.map((child) => (child.type === 'text' ? child.value : '')).join(''),
        sourceText:
          start?.offset !== undefined && end?.offset !== undefined ? source.slice(start.offset, end.offset) : undefined,
      });
      if (embed === undefined) return;

      const promise = Promise.resolve(embed).then((htmlValue) => {
        if (htmlValue && index !== undefined) {
          const htmlNode: Html = { type: 'html', value: htmlValue };
          parent.children[index] = htmlNode;
        }
      });
      promises.push(promise);
    });

    await Promise.all(promises);
  };
};

export default remarkEmbed;

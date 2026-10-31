import { defineMdastPlugin } from 'satteri';
import { createEmbedResolver, type RemarkEmbedOptions } from './resolve.ts';

/** Sätteri 版。ルート直下の単独リンクの段落を、埋め込みの HTML に置き換える */
export function satteriEmbed(options: RemarkEmbedOptions = {}) {
  const resolveEmbed = createEmbedResolver(options);

  return defineMdastPlugin({
    name: 'embed',
    // 原文でリンクが URL だけで書かれているかの判定に、リンクの位置を使う
    options: { position: true },
    async paragraph(node, ctx) {
      if (ctx.parent(node).type !== 'root') return;
      if (node.children.length !== 1 || node.children[0].type !== 'link') return;

      const link = node.children[0];
      const { start, end } = link.position ?? {};
      const html = await resolveEmbed({
        url: link.url,
        text: link.children.map((child) => (child.type === 'text' ? child.value : '')).join(''),
        sourceText:
          start?.offset !== undefined && end?.offset !== undefined
            ? ctx.source.slice(start.offset, end.offset)
            : undefined,
      });
      if (html) ctx.replaceNode(node, { type: 'html', value: html });
    },
  });
}

import { defineMdastPlugin } from 'satteri';

/** remark-breaks 相当。段落内の改行を br にする */
export const satteriBreaks = defineMdastPlugin({
  name: 'breaks',
  text(node, ctx) {
    if (!/[\r\n]/.test(node.value)) return;
    const lines = node.value.split(/\r?\n|\r/);
    const nodes = lines.flatMap((line, index) => [
      ...(index > 0 ? [{ type: 'break' as const }] : []),
      ...(line ? [{ type: 'text' as const, value: line }] : []),
    ]);
    ctx.replaceNode(node, nodes);
  },
});

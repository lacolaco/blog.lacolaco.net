import { gemoji } from 'gemoji';
import { defineHastPlugin } from 'satteri';

// rehype-github-emoji の既定の custom gemoji (絵文字の文字がなく、GitHub が画像で配る名前)
const CUSTOM_NAMES = new Set([
  'atom',
  'basecamp',
  'basecampy',
  'bowtie',
  'electron',
  'feelsgood',
  'finnadie',
  'goberserk',
  'godmode',
  'hurtrealbad',
  'neckbeard',
  'octocat',
  'rage1',
  'rage2',
  'rage3',
  'rage4',
  'shipit',
  'suspect',
  'trollface',
]);
const IMAGE_BASE = 'https://github.githubassets.com/images/icons/emoji/';
const SHORTCODE = /:(\+1|[-\w]+):/g;
// rehype-github-emoji の既定で、これらの中の文字列は置き換えない
const IGNORED_TAGS = new Set(['pre', 'code', 'tt', 'g-emoji']);

const emojiByName = new Map<string, string>();
for (const entry of gemoji) {
  for (const name of entry.names) if (!emojiByName.has(name)) emojiByName.set(name, entry.emoji);
}

/** rehype-github-emoji 相当。`:tada:` などのショートコードを絵文字にする。Unicode の絵文字はそのまま残る */
export const satteriGithubEmoji = defineHastPlugin({
  name: 'github-emoji',
  text(node, ctx) {
    if (!node.value.includes(':')) return;

    for (let ancestor = ctx.parent(node); ancestor.type === 'element'; ancestor = ctx.parent(ancestor)) {
      if (IGNORED_TAGS.has(ancestor.tagName)) return;
    }

    const replaced: Array<{ type: 'text'; value: string } | ReturnType<typeof imageNode>> = [];
    let last = 0;
    let changed = false;
    for (const match of node.value.matchAll(SHORTCODE)) {
      const name = match[1];
      const emoji = emojiByName.get(name);
      const isCustom = CUSTOM_NAMES.has(name);
      if (!isCustom && emoji === undefined) continue;

      changed = true;
      const before = node.value.slice(last, match.index);
      if (isCustom) {
        if (before) replaced.push({ type: 'text', value: before });
        replaced.push(imageNode(name, match[0]));
      } else {
        replaced.push({ type: 'text', value: before + emoji });
      }
      last = match.index + match[0].length;
    }
    if (!changed) return;
    if (last < node.value.length) replaced.push({ type: 'text', value: node.value.slice(last) });
    ctx.replaceNode(node, replaced);
  },
});

function imageNode(name: string, title: string) {
  return {
    type: 'element' as const,
    tagName: 'img',
    properties: {
      className: ['emoji'],
      title,
      alt: title,
      src: `${IMAGE_BASE}${name}.png`,
      height: 20,
      width: 20,
      align: 'absmiddle',
    },
    children: [],
  };
}

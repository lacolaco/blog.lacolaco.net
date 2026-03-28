import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Channelに昇格したタグ: これらはChannel名と対応するため、タグとして記事に残るべきではない
const PROMOTED_TAGS: Record<string, string> = {
  Angular: 'Angular',
  読書: 'Books',
  日記: 'Life',
};

const postsDir = join(import.meta.dirname, '../../../content/post/notion');

function parseFrontmatter(content: string): { tags: string[]; channels: string[] } {
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return { tags: [], channels: [] };
  const fm = fmMatch[1];

  const tags: string[] = [];
  const tagsSection = fm.match(/^tags:\n((?:\s+-\s+'.+?'\n)*)/m);
  if (tagsSection) {
    for (const m of tagsSection[1].matchAll(/^\s+-\s+'(.+?)'/gm)) {
      tags.push(m[1]);
    }
  }

  const channels: string[] = [];
  const channelsSection = fm.match(/^channels:\n((?:\s+-\s+'.+?'\n)*)/m);
  if (channelsSection) {
    for (const m of channelsSection[1].matchAll(/^\s+-\s+'(.+?)'/gm)) {
      channels.push(m[1]);
    }
  }

  return { tags, channels };
}

describe('Channelに昇格したタグがデータに残っていないこと', () => {
  const files = readdirSync(postsDir).filter((f) => f.endsWith('.md'));

  for (const [tagName, channelName] of Object.entries(PROMOTED_TAGS)) {
    it(`${channelName} Channelの記事に${tagName}タグが存在しない`, () => {
      const violations: string[] = [];

      for (const file of files) {
        const content = readFileSync(join(postsDir, file), 'utf-8');
        const { tags, channels } = parseFrontmatter(content);

        if (channels.includes(channelName) && tags.includes(tagName)) {
          violations.push(file);
        }
      }

      expect(violations, `以下の記事に${tagName}タグが残っています`).toEqual([]);
    });
  }
});

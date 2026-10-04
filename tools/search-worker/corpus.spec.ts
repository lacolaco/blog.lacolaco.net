import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getChannels } from '../../src/libs/compat.ts';
import { loadCorpus } from './corpus.ts';

describe('loadCorpus', () => {
  it('channels は本番 (search-docs.json) と同じ getChannels の並び順になる', () => {
    const corpus = loadCorpus();
    const multi = corpus.filter((d) => d.channels.length > 1);
    // 前提: 並べ替えが効果を持つ、複数のチャンネルを持つ記事がある
    assert.ok(multi.length > 0);
    for (const d of corpus) {
      // getChannels は CollectionEntry を受けるが、使うのは data.channels だけ
      const expected = getChannels({ data: { channels: d.channels } } as Parameters<typeof getChannels>[0]);
      assert.deepEqual(d.channels, expected, `${d.slug}:${d.locale}`);
    }
  });
});

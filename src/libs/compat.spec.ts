import { describe, it, expect, vi } from 'vitest';
import type { CollectionEntry } from 'astro:content';

// channels定義順をモックする
vi.mock('./post/properties', () => ({
  channels: [
    { id: 'code', name: 'Code', color: 'blue', description: null },
    { id: 'angular', name: 'Angular', color: 'red', description: null },
    { id: 'books', name: 'Books', color: 'brown', description: null },
    { id: 'thought', name: 'Thought', color: 'yellow', description: null },
    { id: 'life', name: 'Life', color: 'purple', description: null },
  ],
}));

function createMockPost(channels?: string[]): CollectionEntry<'posts'> {
  return {
    id: 'test.md',
    slug: 'test',
    body: '',
    collection: 'posts',
    data: {
      slug: 'test',
      title: 'Test',
      created_time: new Date('2024-01-01'),
      last_edited_time: new Date('2024-01-01'),
      tags: [],
      published: true,
      locale: 'ja',
      channels,
    },
  } as CollectionEntry<'posts'>;
}

describe('getChannels', () => {
  it('投稿のchannelsをchannels定義順でソートする', async () => {
    const { getChannels } = await import('./compat');
    const post = createMockPost(['Angular', 'Code']);
    // channels定義順: Code, Angular, Books, Thought, Life
    expect(getChannels(post)).toEqual(['Code', 'Angular']);
  });

  it('3つ以上のchannelsも定義順でソートする', async () => {
    const { getChannels } = await import('./compat');
    const post = createMockPost(['Life', 'Code', 'Thought']);
    expect(getChannels(post)).toEqual(['Code', 'Thought', 'Life']);
  });

  it('定義順に存在しないチャンネルは末尾に配置する', async () => {
    const { getChannels } = await import('./compat');
    const post = createMockPost(['Unknown', 'Code']);
    expect(getChannels(post)).toEqual(['Code', 'Unknown']);
  });

  it('channelsが未定義の場合は空配列を返す', async () => {
    const { getChannels } = await import('./compat');
    const post = createMockPost(undefined);
    expect(getChannels(post)).toEqual([]);
  });

  it('channelsが空配列の場合は空配列を返す', async () => {
    const { getChannels } = await import('./compat');
    const post = createMockPost([]);
    expect(getChannels(post)).toEqual([]);
  });
});

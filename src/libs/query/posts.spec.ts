import { describe, it, expect } from 'vitest';
import { queryAdjacentPosts, deduplicatePosts } from './posts';
import type { CollectionEntry } from 'astro:content';

// テスト用のモックデータを作成するヘルパー関数
function createMockPost(slug: string, createdTime: Date, locale: string = 'ja'): CollectionEntry<'posts'> {
  return {
    id: `${slug}.md`,
    slug,
    body: '',
    collection: 'posts',
    data: {
      slug,
      title: `Test Post ${slug}`,
      icon: '📝',
      created_time: createdTime,
      last_edited_time: createdTime,
      tags: [],
      published: true,
      locale,
      notion_url: 'https://notion.so/test',
    },
  } as CollectionEntry<'posts'>;
}

// 英語版の投稿を作成するヘルパー関数
function createMockEnPost(slug: string, createdTime: Date): CollectionEntry<'postsEn'> {
  return {
    id: `${slug}.en.md`,
    slug,
    body: '',
    collection: 'postsEn',
    data: {
      slug,
      title: `Test Post ${slug} (EN)`,
      icon: '📝',
      created_time: createdTime,
      last_edited_time: createdTime,
      tags: [],
      published: true,
      locale: 'en',
      notion_url: 'https://notion.so/test',
    },
  } as CollectionEntry<'postsEn'>;
}

describe('queryAdjacentPosts', () => {
  it('時系列順に前後の記事を正しく取得できる', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01')),
      createMockPost('post-2', new Date('2023-01-02')),
      createMockPost('post-3', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-2');

    expect(result.prev).not.toBeNull();
    expect(result.prev?.data.slug).toBe('post-1');
    expect(result.next).not.toBeNull();
    expect(result.next?.data.slug).toBe('post-3');
  });

  it('最初の記事の場合、prevがnullになる', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01')),
      createMockPost('post-2', new Date('2023-01-02')),
      createMockPost('post-3', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-1');

    expect(result.prev).toBeNull();
    expect(result.next).not.toBeNull();
    expect(result.next?.data.slug).toBe('post-2');
  });

  it('最後の記事の場合、nextがnullになる', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01')),
      createMockPost('post-2', new Date('2023-01-02')),
      createMockPost('post-3', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-3');

    expect(result.prev).not.toBeNull();
    expect(result.prev?.data.slug).toBe('post-2');
    expect(result.next).toBeNull();
  });

  it('記事が1つしかない場合、両方nullになる', () => {
    const posts = [createMockPost('post-1', new Date('2023-01-01'))];

    const result = queryAdjacentPosts(posts, 'post-1');

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });

  it('存在しないスラッグの場合、両方nullになる', () => {
    const posts = [createMockPost('post-1', new Date('2023-01-01')), createMockPost('post-2', new Date('2023-01-02'))];

    const result = queryAdjacentPosts(posts, 'non-existent');

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });

  it('ロケールが異なる記事も含まれる', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockPost('post-2', new Date('2023-01-02'), 'en'),
      createMockPost('post-3', new Date('2023-01-03'), 'ja'),
    ];

    const result = queryAdjacentPosts(posts, 'post-2');

    // ロケールが異なっても前後の記事として取得される
    expect(result.prev).not.toBeNull();
    expect(result.prev?.data.slug).toBe('post-1');
    expect(result.prev?.data.locale).toBe('ja');
    expect(result.next).not.toBeNull();
    expect(result.next?.data.slug).toBe('post-3');
    expect(result.next?.data.locale).toBe('ja');
  });

  it('時系列順（古い順）に正しくソートされる', () => {
    const posts = [
      createMockPost('post-3', new Date('2023-01-03')),
      createMockPost('post-1', new Date('2023-01-01')),
      createMockPost('post-2', new Date('2023-01-02')),
    ];

    const result = queryAdjacentPosts(posts, 'post-2');

    // ソート後、post-1 → post-2 → post-3 となる
    expect(result.prev?.data.slug).toBe('post-1');
    expect(result.next?.data.slug).toBe('post-3');
  });

  it('空の配列の場合、両方nullになる', () => {
    const posts: Array<CollectionEntry<'posts'>> = [];

    const result = queryAdjacentPosts(posts, 'post-1');

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });
});

describe('deduplicatePosts', () => {
  it('同じslugを持つ日本語版と英語版がある場合、日本語版のみが残る', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockEnPost('post-1', new Date('2023-01-01')),
    ];

    const result = deduplicatePosts(posts);

    expect(result).toHaveLength(1);
    expect(result[0].data.locale).toBe('ja');
    expect(result[0].data.slug).toBe('post-1');
  });

  it('英語版のみの投稿は残る', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockEnPost('post-2', new Date('2023-01-02')),
    ];

    const result = deduplicatePosts(posts);

    expect(result).toHaveLength(2);
    expect(result.find((p) => p.data.slug === 'post-1')?.data.locale).toBe('ja');
    expect(result.find((p) => p.data.slug === 'post-2')?.data.locale).toBe('en');
  });

  it('日本語版のみの投稿は残る', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockPost('post-2', new Date('2023-01-02'), 'ja'),
    ];

    const result = deduplicatePosts(posts);

    expect(result).toHaveLength(2);
    expect(result[0].data.locale).toBe('ja');
    expect(result[1].data.locale).toBe('ja');
  });

  it('複数の記事で日英両方がある場合、それぞれ日本語版のみが残る', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockEnPost('post-1', new Date('2023-01-01')),
      createMockPost('post-2', new Date('2023-01-02'), 'ja'),
      createMockEnPost('post-2', new Date('2023-01-02')),
      createMockPost('post-3', new Date('2023-01-03'), 'ja'),
    ];

    const result = deduplicatePosts(posts);

    expect(result).toHaveLength(3);
    expect(result.every((p) => p.data.locale === 'ja')).toBe(true);
  });

  it('空の配列の場合、空の配列が返る', () => {
    const posts: Array<CollectionEntry<'posts' | 'postsEn'>> = [];

    const result = deduplicatePosts(posts);

    expect(result).toHaveLength(0);
  });

  it('重複がない場合、全ての投稿が残る', () => {
    const posts = [
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockPost('post-2', new Date('2023-01-02'), 'ja'),
      createMockEnPost('post-3', new Date('2023-01-03')),
    ];

    const result = deduplicatePosts(posts);

    expect(result).toHaveLength(3);
  });

  it('重複除外時に元の配列の順序を維持する', () => {
    const posts = [
      createMockPost('post-3', new Date('2023-01-03'), 'ja'),
      createMockEnPost('post-3', new Date('2023-01-03')),
      createMockPost('post-2', new Date('2023-01-02'), 'ja'),
      createMockPost('post-1', new Date('2023-01-01'), 'ja'),
      createMockEnPost('post-1', new Date('2023-01-01')),
    ];

    const result = deduplicatePosts(posts);

    // 元の配列の順序（post-3, post-2, post-1）が維持されることを確認
    expect(result).toHaveLength(3);
    expect(result[0].data.slug).toBe('post-3');
    expect(result[1].data.slug).toBe('post-2');
    expect(result[2].data.slug).toBe('post-1');
    expect(result.every((p) => p.data.locale === 'ja')).toBe(true);
  });
});

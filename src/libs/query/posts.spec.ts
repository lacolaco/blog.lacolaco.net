import { describe, it, expect } from 'vitest';
import { queryAdjacentPosts } from './posts';
import type { CollectionEntry } from 'astro:content';

// テスト用のモックデータを作成するヘルパー関数
function createMockPost(
  slug: string,
  category: string,
  createdTime: Date,
  locale: string = 'ja',
): CollectionEntry<'postsV2'> {
  return {
    id: `${slug}.md`,
    slug,
    body: '',
    collection: 'postsV2',
    data: {
      slug,
      title: `Test Post ${slug}`,
      icon: '📝',
      created_time: createdTime,
      last_edited_time: createdTime,
      category,
      tags: [],
      published: true,
      locale,
      notion_url: 'https://notion.so/test',
    },
  } as CollectionEntry<'postsV2'>;
}

describe('queryAdjacentPosts', () => {
  it('時系列順に前後の記事を正しく取得できる', () => {
    const posts = [
      createMockPost('post-1', 'tech', new Date('2023-01-01')),
      createMockPost('post-2', 'blog', new Date('2023-01-02')),
      createMockPost('post-3', 'tech', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-2');

    expect(result.prev).not.toBeNull();
    expect(result.prev?.data.slug).toBe('post-1');
    expect(result.next).not.toBeNull();
    expect(result.next?.data.slug).toBe('post-3');
  });

  it('最初の記事の場合、prevがnullになる', () => {
    const posts = [
      createMockPost('post-1', 'tech', new Date('2023-01-01')),
      createMockPost('post-2', 'tech', new Date('2023-01-02')),
      createMockPost('post-3', 'tech', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-1');

    expect(result.prev).toBeNull();
    expect(result.next).not.toBeNull();
    expect(result.next?.data.slug).toBe('post-2');
  });

  it('最後の記事の場合、nextがnullになる', () => {
    const posts = [
      createMockPost('post-1', 'tech', new Date('2023-01-01')),
      createMockPost('post-2', 'tech', new Date('2023-01-02')),
      createMockPost('post-3', 'tech', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-3');

    expect(result.prev).not.toBeNull();
    expect(result.prev?.data.slug).toBe('post-2');
    expect(result.next).toBeNull();
  });

  it('記事が1つしかない場合、両方nullになる', () => {
    const posts = [createMockPost('post-1', 'tech', new Date('2023-01-01'))];

    const result = queryAdjacentPosts(posts, 'post-1');

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });

  it('存在しないスラッグの場合、両方nullになる', () => {
    const posts = [
      createMockPost('post-1', 'tech', new Date('2023-01-01')),
      createMockPost('post-2', 'tech', new Date('2023-01-02')),
    ];

    const result = queryAdjacentPosts(posts, 'non-existent');

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });

  it('カテゴリが異なる記事も含まれる', () => {
    const posts = [
      createMockPost('post-1', 'tech', new Date('2023-01-01')),
      createMockPost('post-2', 'blog', new Date('2023-01-02')),
      createMockPost('post-3', 'tech', new Date('2023-01-03')),
    ];

    const result = queryAdjacentPosts(posts, 'post-2');

    // カテゴリに関係なく、時系列順で前後の記事を取得
    expect(result.prev).not.toBeNull();
    expect(result.prev?.data.slug).toBe('post-1');
    expect(result.prev?.data.category).toBe('tech');
    expect(result.next).not.toBeNull();
    expect(result.next?.data.slug).toBe('post-3');
    expect(result.next?.data.category).toBe('tech');
  });

  it('ロケールが異なる記事も含まれる', () => {
    const posts = [
      createMockPost('post-1', 'tech', new Date('2023-01-01'), 'ja'),
      createMockPost('post-2', 'tech', new Date('2023-01-02'), 'en'),
      createMockPost('post-3', 'tech', new Date('2023-01-03'), 'ja'),
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
      createMockPost('post-3', 'tech', new Date('2023-01-03')),
      createMockPost('post-1', 'tech', new Date('2023-01-01')),
      createMockPost('post-2', 'blog', new Date('2023-01-02')),
    ];

    const result = queryAdjacentPosts(posts, 'post-2');

    // ソート後、post-1 → post-2 → post-3 となる
    expect(result.prev?.data.slug).toBe('post-1');
    expect(result.next?.data.slug).toBe('post-3');
  });

  it('空の配列の場合、両方nullになる', () => {
    const posts: Array<CollectionEntry<'postsV2'>> = [];

    const result = queryAdjacentPosts(posts, 'post-1');

    expect(result.prev).toBeNull();
    expect(result.next).toBeNull();
  });
});

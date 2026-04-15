import { describe, it, expect } from 'vitest';
import { PostFrontmatter } from './schema';
import * as schema from './schema';

describe('PostFrontmatter', () => {
  it('Category/Categories型がエクスポートされていない', () => {
    expect('Category' in schema).toBe(false);
    expect('Categories' in schema).toBe(false);
  });

  it('categoryフィールドなしでパースできる', () => {
    const input = {
      title: 'Test',
      slug: 'test',
      created_time: '2023-01-01T00:00:00.000Z',
      last_edited_time: '2023-01-01T00:00:00.000Z',
      tags: ['test'],
      published: true,
    };
    const result = PostFrontmatter.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect('category' in result.data).toBe(false);
    }
  });
});

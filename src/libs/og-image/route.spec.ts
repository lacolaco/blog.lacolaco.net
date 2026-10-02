import { describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
import { GET } from '../../pages/og/[slug].png';

const posts = [
  { collection: 'posts', data: { slug: 'same', title: '日本語の題名', created_time: new Date('2024-01-01') } },
  { collection: 'postsEn', data: { slug: 'same', title: 'English title', created_time: new Date('2024-01-01') } },
  { collection: 'posts', data: { slug: 'japanese-only', title: '日本語のみ', created_time: new Date('2024-01-01') } },
];

vi.mock('@lib/query', () => ({ queryAvailablePosts: () => Promise.resolve(posts) }));
vi.mock('./generate', () => ({
  generateOgImage: vi.fn(() => Promise.resolve(Buffer.from('png'))),
}));

import { generateOgImage } from './generate';

function context(slug: string): APIContext {
  return { params: { slug } } as APIContext;
}

describe('OG image route', () => {
  it('selects the English title for an English image URL', async () => {
    await GET(context('same.en'));

    expect(generateOgImage).toHaveBeenCalledWith({
      title: 'English title',
      publishedDate: new Date('2024-01-01'),
    });
  });

  it('selects the Japanese title for the existing image URL', async () => {
    await GET(context('same'));

    expect(generateOgImage).toHaveBeenCalledWith({
      title: '日本語の題名',
      publishedDate: new Date('2024-01-01'),
    });
  });

  it('returns 404 when the requested translation does not exist', async () => {
    const response = await GET(context('japanese-only.en'));

    expect(response.status).toBe(404);
  });
});

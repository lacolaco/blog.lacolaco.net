import { describe, it, expect } from 'vitest';
import { buildRssCategories } from './rss-categories';

describe('buildRssCategories', () => {
  it('channelsをtagsの先頭に含める', () => {
    const result = buildRssCategories({
      channels: ['Angular'],
      tags: ['TypeScript', 'Web'],
    });
    expect(result).toEqual(['Angular', 'TypeScript', 'Web']);
  });

  it('複数channelsをtagsの先頭に含める', () => {
    const result = buildRssCategories({
      channels: ['Angular', 'Frontend'],
      tags: ['TypeScript'],
    });
    expect(result).toEqual(['Angular', 'Frontend', 'TypeScript']);
  });

  it('channelsがundefinedでもtagsを返す', () => {
    const result = buildRssCategories({
      channels: undefined,
      tags: ['TypeScript', 'Web'],
    });
    expect(result).toEqual(['TypeScript', 'Web']);
  });

  it('channelsが空配列でもtagsを返す', () => {
    const result = buildRssCategories({
      channels: [],
      tags: ['TypeScript'],
    });
    expect(result).toEqual(['TypeScript']);
  });

  it('tagsが空でもchannelsを返す', () => {
    const result = buildRssCategories({
      channels: ['Angular'],
      tags: [],
    });
    expect(result).toEqual(['Angular']);
  });
});

import { describe, it, expect } from 'vitest';
import { mergeByName } from './properties';

describe('mergeByName', () => {
  it('空配列同士のマージは空配列を返す', () => {
    const result = mergeByName([], []);
    expect(result).toEqual([]);
  });

  it('baseのみの場合はbaseをそのまま返す', () => {
    const base = [{ name: 'a', value: 1 }];
    const result = mergeByName(base, []);
    expect(result).toEqual([{ name: 'a', value: 1 }]);
  });

  it('overrideのみの場合はoverrideをそのまま返す', () => {
    const override = [{ name: 'a', value: 1 }];
    const result = mergeByName([], override);
    expect(result).toEqual([{ name: 'a', value: 1 }]);
  });

  it('重複がない場合は両方の要素を含む', () => {
    const base = [{ name: 'a', value: 1 }];
    const override = [{ name: 'b', value: 2 }];
    const result = mergeByName(base, override);
    expect(result).toHaveLength(2);
    expect(result).toContainEqual({ name: 'a', value: 1 });
    expect(result).toContainEqual({ name: 'b', value: 2 });
  });

  it('同名の要素はoverrideが優先される', () => {
    const base = [{ name: 'a', value: 1, extra: 'base' }];
    const override = [{ name: 'a', value: 99, extra: 'override' }];
    const result = mergeByName(base, override);
    expect(result).toEqual([{ name: 'a', value: 99, extra: 'override' }]);
  });

  it('複数要素のマージ: 一部重複、一部新規', () => {
    const base = [
      { name: 'a', value: 1 },
      { name: 'b', value: 2 },
      { name: 'c', value: 3 },
    ];
    const override = [
      { name: 'b', value: 20 }, // 上書き
      { name: 'd', value: 4 }, // 新規追加
    ];
    const result = mergeByName(base, override);
    expect(result).toHaveLength(4);
    expect(result.find((x) => x.name === 'a')).toEqual({ name: 'a', value: 1 });
    expect(result.find((x) => x.name === 'b')).toEqual({ name: 'b', value: 20 }); // overrideの値
    expect(result.find((x) => x.name === 'c')).toEqual({ name: 'c', value: 3 });
    expect(result.find((x) => x.name === 'd')).toEqual({ name: 'd', value: 4 });
  });

  it('Tag型に相当する構造でのマージ', () => {
    type TagLike = { name: string; color: string };
    const notionTags: TagLike[] = [
      { name: 'JavaScript', color: 'yellow' },
      { name: 'TypeScript', color: 'blue' },
    ];
    const manualTags: TagLike[] = [
      { name: 'TypeScript', color: 'custom-blue' }, // 上書き
    ];
    const result = mergeByName(notionTags, manualTags);
    expect(result).toHaveLength(2);
    expect(result.find((t) => t.name === 'TypeScript')?.color).toBe('custom-blue');
    expect(result.find((t) => t.name === 'JavaScript')?.color).toBe('yellow');
  });
});

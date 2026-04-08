import { describe, it, expect } from 'vitest';
import { optimisticToggle } from './optimistic';
import type { LikeState } from './optimistic';

describe('optimisticToggle', () => {
  it('liked状態からunlikedへ: countが1減少', () => {
    const state: LikeState = { count: 3, liked: true };
    expect(optimisticToggle(state)).toEqual({ count: 2, liked: false });
  });

  it('unliked状態からlikedへ: countが1増加', () => {
    const state: LikeState = { count: 2, liked: false };
    expect(optimisticToggle(state)).toEqual({ count: 3, liked: true });
  });

  it('count 0からlikedへ: countが1になる', () => {
    const state: LikeState = { count: 0, liked: false };
    expect(optimisticToggle(state)).toEqual({ count: 1, liked: true });
  });

  it('count 1からunlikedへ: countが0になる', () => {
    const state: LikeState = { count: 1, liked: true };
    expect(optimisticToggle(state)).toEqual({ count: 0, liked: false });
  });

  it('count 0でliked=trueの場合: countは0を下回らない', () => {
    const state: LikeState = { count: 0, liked: true };
    expect(optimisticToggle(state)).toEqual({ count: 0, liked: false });
  });

  it('元の状態を変更しない（不変性）', () => {
    const state: LikeState = { count: 5, liked: true };
    const result = optimisticToggle(state);
    expect(state).toEqual({ count: 5, liked: true });
    expect(result).not.toBe(state);
  });
});

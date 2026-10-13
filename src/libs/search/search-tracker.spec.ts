import { describe, expect, it } from 'vitest';
import { createSearchTermTracker } from './search-tracker';

describe('createSearchTermTracker', () => {
  it('最初の語は数える', () => {
    expect(createSearchTermTracker().shouldCount('angular')).toBe(true);
  });

  it('同じ語の連続は数えない', () => {
    const t = createSearchTermTracker();
    expect(t.shouldCount('angular')).toBe(true);
    expect(t.shouldCount('angular')).toBe(false);
  });

  it('前後の空白だけ違う語は同じ語として扱う', () => {
    const t = createSearchTermTracker();
    t.shouldCount('angular');
    expect(t.shouldCount(' angular ')).toBe(false);
  });

  it('語が変われば数える。直前の語に戻っても数える', () => {
    const t = createSearchTermTracker();
    expect(t.shouldCount('a')).toBe(true);
    expect(t.shouldCount('b')).toBe(true);
    expect(t.shouldCount('a')).toBe(true);
  });

  it('空や空白だけは数えず、直前の語を忘れる', () => {
    const t = createSearchTermTracker();
    t.shouldCount('a');
    expect(t.shouldCount('')).toBe(false);
    expect(t.shouldCount('   ')).toBe(false);
    expect(t.shouldCount('a')).toBe(true);
  });

  it('reset で直前の語を忘れる', () => {
    const t = createSearchTermTracker();
    t.shouldCount('a');
    t.reset();
    expect(t.shouldCount('a')).toBe(true);
  });
});

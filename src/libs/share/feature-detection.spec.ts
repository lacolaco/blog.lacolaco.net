import { describe, it, expect, afterEach, vi } from 'vitest';
import { checkShareAvailability } from './feature-detection';

/** globalThis.navigator は getter のみのためvi.stubGlobalで差し替える */
function setNavigator(value: unknown): void {
  vi.stubGlobal('navigator', value);
}

function clearNavigator(): void {
  vi.unstubAllGlobals();
}

describe('checkShareAvailability', () => {
  afterEach(() => {
    clearNavigator();
  });

  it('navigatorが存在しない場合、unavailableを返す', () => {
    setNavigator(undefined);
    expect(checkShareAvailability()).toBe('unavailable');
  });

  it('navigator.shareが存在しない場合、unavailableを返す', () => {
    setNavigator({});
    expect(checkShareAvailability()).toBe('unavailable');
  });

  it('navigator.shareが関数でない場合、unavailableを返す', () => {
    setNavigator({ share: 'not a function' });
    expect(checkShareAvailability()).toBe('unavailable');
  });

  it('navigator.shareが関数の場合、availableを返す', () => {
    setNavigator({ share: vi.fn() });
    expect(checkShareAvailability()).toBe('available');
  });
});

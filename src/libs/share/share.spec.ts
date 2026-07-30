import { describe, it, expect, afterEach, vi } from 'vitest';
import { shareContent } from './share';

/** globalThis.navigator は getter のみのためvi.stubGlobalで差し替える */
function setNavigator(value: unknown): void {
  vi.stubGlobal('navigator', value);
}

function clearNavigator(): void {
  vi.unstubAllGlobals();
}

const content = { title: 'テスト記事 | lacolaco.net', url: 'https://blog.lacolaco.net/posts/test' };

describe('shareContent', () => {
  afterEach(() => {
    clearNavigator();
  });

  it('Web Share API 非対応の場合、unavailableを返す', async () => {
    setNavigator({});
    expect(await shareContent(content)).toEqual({ status: 'unavailable' });
  });

  it('共有が成功した場合、successを返す', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setNavigator({ share });

    expect(await shareContent(content)).toEqual({ status: 'success' });
    expect(share).toHaveBeenCalledWith({ title: content.title, url: content.url });
  });

  it('ユーザーが共有シートを閉じた場合(AbortError)、cancelledを返す', async () => {
    const abortError = Object.assign(new Error('Share canceled'), { name: 'AbortError' });
    setNavigator({ share: vi.fn().mockRejectedValue(abortError) });

    expect(await shareContent(content)).toEqual({ status: 'cancelled' });
  });

  it('AbortErrorがDOMExceptionで投げられた場合もcancelledを返す', async () => {
    setNavigator({ share: vi.fn().mockRejectedValue(new DOMException('Share canceled', 'AbortError')) });

    expect(await shareContent(content)).toEqual({ status: 'cancelled' });
  });

  it('その他の失敗の場合、errorとメッセージを返す', async () => {
    setNavigator({ share: vi.fn().mockRejectedValue(new Error('Permission denied')) });

    expect(await shareContent(content)).toEqual({ status: 'error', message: 'Permission denied' });
  });

  it('Errorでない値がthrowされた場合もerrorを返す', async () => {
    setNavigator({ share: vi.fn().mockRejectedValue('unknown failure') });

    expect(await shareContent(content)).toEqual({ status: 'error', message: 'unknown failure' });
  });
});

/**
 * NativeShareButton コンポーネントテスト
 * src/pages/ に配置するとAstroがルートとして処理するため src/components/ に配置
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import NativeShareButton from './NativeShareButton';

const { mockTrackEvent } = vi.hoisted(() => ({ mockTrackEvent: vi.fn() }));

vi.mock('../libs/analytics', async (importOriginal) => {
  const original = await importOriginal<typeof import('../libs/analytics')>();
  return { ...original, trackEvent: mockTrackEvent };
});

/** jsdomのnavigatorにshareを生やす（jsdomは未実装のためdefinePropertyで注入する） */
function setShare(share: unknown): void {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
}

function deleteShare(): void {
  if ('share' in navigator) {
    delete (navigator as unknown as { share?: unknown }).share;
  }
}

describe('NativeShareButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteShare();
  });

  afterEach(() => {
    cleanup();
    deleteShare();
  });

  const props = { title: 'テスト記事 | lacolaco.net', url: 'https://blog.lacolaco.net/posts/test' };

  it('Web Share API 非対応の場合、ボタンを描画しない', async () => {
    render(<NativeShareButton {...props} />);

    await waitFor(() => {
      expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });
  });

  it('Web Share API 対応の場合、ボタンを描画する', async () => {
    setShare(vi.fn().mockResolvedValue(undefined));
    render(<NativeShareButton {...props} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '共有' })).toBeInTheDocument();
    });
  });

  it('locale=enの場合、英語のラベルを表示する', async () => {
    setShare(vi.fn().mockResolvedValue(undefined));
    render(<NativeShareButton {...props} locale="en" />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    });
  });

  it('クリックするとタイトルとURLを共有し、完了イベントを送信する', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    render(<NativeShareButton {...props} />);
    const button = await screen.findByRole('button');

    button.click();

    expect(share).toHaveBeenCalledWith({ title: props.title, url: props.url });
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'share_complete' });
    });
  });

  it('ユーザーがキャンセルした場合、エラーイベントを送信しない', async () => {
    setShare(vi.fn().mockRejectedValue(new DOMException('Share canceled', 'AbortError')));
    render(<NativeShareButton {...props} />);
    const button = await screen.findByRole('button');

    button.click();

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'share_cancel' });
    });
    expect(mockTrackEvent).not.toHaveBeenCalledWith(expect.objectContaining({ name: 'share_error' }));
  });

  it('共有中の再クリックを無視する（共有シートが開いている間の二重呼び出しを防ぐ）', async () => {
    let resolveShare: () => void = () => {};
    const share = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveShare = resolve;
        }),
    );
    setShare(share);
    render(<NativeShareButton {...props} />);
    const button = await screen.findByRole('button');

    button.click();
    button.click();

    expect(share).toHaveBeenCalledTimes(1);

    resolveShare();
    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({ name: 'share_complete' });
    });

    // 共有完了後は再度共有できる
    button.click();
    expect(share).toHaveBeenCalledTimes(2);
  });

  it('共有が失敗した場合、エラーイベントを送信する', async () => {
    setShare(vi.fn().mockRejectedValue(new Error('Permission denied')));
    render(<NativeShareButton {...props} />);
    const button = await screen.findByRole('button');

    button.click();

    await waitFor(() => {
      expect(mockTrackEvent).toHaveBeenCalledWith({
        name: 'share_error',
        params: { error_message: 'Permission denied' },
      });
    });
  });
});

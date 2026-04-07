/**
 * LikeButton コンポーネントテスト
 * src/pages/ に配置するとAstroがルートとして処理するため src/components/ に配置
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, act } from '@testing-library/react';
import LikeButton from './LikeButton';

// client.ts のモック
vi.mock('../libs/likes/client', () => ({
  getOrCreateClientId: vi.fn(() => 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee'),
  fetchLikeStatus: vi.fn(),
  sendToggleLike: vi.fn(),
}));

// analytics.ts のモック
vi.mock('../libs/analytics', () => ({
  trackEvent: vi.fn(),
  likeEvents: {
    toggle: vi.fn(() => ({ name: 'like_toggle', params: {} })),
    error: vi.fn(() => ({ name: 'like_error', params: {} })),
  },
}));

import { fetchLikeStatus, sendToggleLike } from '../libs/likes/client';

const mockFetchLikeStatus = vi.mocked(fetchLikeStatus);
const mockSendToggleLike = vi.mocked(sendToggleLike);

describe('LikeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchLikeStatus.mockResolvedValue({ count: 0, liked: false });
    mockSendToggleLike.mockResolvedValue({ count: 1, liked: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初期フェッチの結果がUIに反映される', async () => {
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 5, liked: true });

    // eslint-disable-next-line @typescript-eslint/require-await -- act requires async for microtask flushing
    await act(async () => {
      render(<LikeButton slug="test-post" variant="standard" />);
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('5');
  });

  it('compact variantでカウントが0のときカウント表示なし', async () => {
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 0, liked: false });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      render(<LikeButton slug="test-post" variant="compact" />);
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveTextContent(/\d/);
  });

  it('クリック時に楽観的UI更新が発生する', async () => {
    let resolveToggle: (value: { count: number; liked: boolean }) => void;
    mockSendToggleLike.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveToggle = resolve;
        }),
    );
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 3, liked: false });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      render(<LikeButton slug="test-post" variant="standard" />);
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      button.click();
    });

    // API応答前に楽観的にliked=trueになる
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveTextContent('4');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      resolveToggle!({ count: 4, liked: true });
    });

    expect(button).toHaveAttribute('aria-pressed', 'true');
  });

  it('APIエラー時にロールバックが動作する', async () => {
    mockSendToggleLike.mockRejectedValueOnce(new Error('Server error'));
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 2, liked: false });

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      render(<LikeButton slug="test-post" variant="standard" />);
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      button.click();
    });

    // ロールバック後は元の状態に戻る
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('2');
  });

  it('初期フェッチ失敗時はデフォルト状態（count:0, liked:false）', async () => {
    mockFetchLikeStatus.mockRejectedValueOnce(new Error('Network error'));

    // eslint-disable-next-line @typescript-eslint/require-await
    await act(async () => {
      render(<LikeButton slug="test-post" variant="standard" />);
    });

    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-pressed', 'false');
  });
});

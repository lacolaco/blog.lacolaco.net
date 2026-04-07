/**
 * LikeButton コンポーネントテスト
 * src/pages/ に配置するとAstroがルートとして処理するため src/components/ に配置
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
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
    cleanup();
    vi.restoreAllMocks();
  });

  it('初期フェッチの結果がUIに反映される', async () => {
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 5, liked: true });

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button')).toHaveTextContent('5');
  });

  it('compact variantでカウントが0のときカウント表示なし', async () => {
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 0, liked: false });

    render(<LikeButton slug="test-post" variant="compact" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button')).not.toHaveTextContent(/\d/);
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

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    screen.getByRole('button').click();

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button')).toHaveTextContent('4');

    resolveToggle!({ count: 4, liked: true });
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
  });

  it('APIエラー時にロールバックが動作する', async () => {
    mockSendToggleLike.mockRejectedValueOnce(new Error('Server error'));
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 2, liked: false });

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    screen.getByRole('button').click();

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByRole('button')).toHaveTextContent('2');
  });

  it('初期フェッチ失敗時はデフォルト状態（count:0, liked:false）', async () => {
    mockFetchLikeStatus.mockRejectedValueOnce(new Error('Network error'));

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('初期fetch中はボタンが無効化される', () => {
    mockFetchLikeStatus.mockReturnValue(new Promise(() => {}));

    render(<LikeButton slug="test-post" variant="standard" />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('compact/standard間のCustomEvent同期が動作する', async () => {
    mockFetchLikeStatus.mockResolvedValue({ count: 3, liked: false });
    mockSendToggleLike.mockResolvedValueOnce({ count: 4, liked: true });

    render(
      <div>
        <LikeButton slug="test-post" variant="compact" />
        <LikeButton slug="test-post" variant="standard" />
      </div>,
    );

    const buttons = await waitFor(() => {
      const btns = screen.getAllByRole('button');
      expect(btns).toHaveLength(2);
      btns.forEach((btn) => expect(btn).not.toBeDisabled());
      return btns;
    });

    buttons[0].click();

    await waitFor(() => {
      buttons.forEach((btn) => {
        expect(btn).toHaveAttribute('aria-pressed', 'true');
      });
    });
  });
});

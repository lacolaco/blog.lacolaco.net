/**
 * LikeButton コンポーネントテスト
 * src/pages/ に配置するとAstroがルートとして処理するため src/components/ に配置
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';

// vi.hoisted()でモック関数を先に作成し、vi.resetModules()後も同一参照を維持する
const { mockGetOrCreateClientId, mockFetchLikeStatus, mockSendToggleLike } = vi.hoisted(() => ({
  mockGetOrCreateClientId: vi.fn(() => 'aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee'),
  mockFetchLikeStatus: vi.fn(),
  mockSendToggleLike: vi.fn(),
}));

vi.mock('../libs/likes/client', () => ({
  getOrCreateClientId: mockGetOrCreateClientId,
  fetchLikeStatus: mockFetchLikeStatus,
  sendToggleLike: mockSendToggleLike,
}));

describe('LikeButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // cachedClientIdモジュール変数をリセット（vi.hoistedのおかげでモック参照は安定）
    vi.resetModules();
    mockFetchLikeStatus.mockResolvedValue({ count: 0, liked: false });
    mockSendToggleLike.mockResolvedValue({ count: 1, liked: true });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  async function importLikeButton() {
    const mod = await import('./LikeButton');
    return mod.default;
  }

  it('初期フェッチの結果がUIに反映される', async () => {
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 5, liked: true });
    const LikeButton = await importLikeButton();

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });
    expect(screen.getByRole('button')).toHaveTextContent('5');
  });

  it('compact variantでカウントが0のとき0が表示される', async () => {
    mockFetchLikeStatus.mockResolvedValueOnce({ count: 0, liked: false });
    const LikeButton = await importLikeButton();

    render(<LikeButton slug="test-post" variant="compact" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button')).toHaveTextContent('0');
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
    const LikeButton = await importLikeButton();

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
    const LikeButton = await importLikeButton();

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });

    screen.getByRole('button').click();

    // 楽観的更新が発生したことを確認
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    // ロールバック後を確認
    await waitFor(() => {
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
    expect(screen.getByRole('button')).toHaveTextContent('2');
  });

  it('初期フェッチ失敗時はデフォルト状態（count:0, liked:false）', async () => {
    mockFetchLikeStatus.mockRejectedValueOnce(new Error('Network error'));
    const LikeButton = await importLikeButton();

    render(<LikeButton slug="test-post" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
  });

  it('初期fetch中はボタンが無効化される', async () => {
    mockFetchLikeStatus.mockReturnValue(new Promise(() => {}));
    const LikeButton = await importLikeButton();

    render(<LikeButton slug="test-post" variant="standard" />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('compact/standard間のCustomEvent同期が動作する', async () => {
    mockFetchLikeStatus.mockResolvedValue({ count: 3, liked: false });
    mockSendToggleLike.mockResolvedValueOnce({ count: 4, liked: true });
    const LikeButton = await importLikeButton();

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
        expect(btn).toHaveTextContent('4');
      });
    });
  });

  it('無効なslugの場合はAPIコールせずローディング解除', async () => {
    const LikeButton = await importLikeButton();

    render(<LikeButton slug="" variant="standard" />);

    await waitFor(() => {
      expect(screen.getByRole('button')).not.toBeDisabled();
    });
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    expect(mockFetchLikeStatus).not.toHaveBeenCalled();
  });
});

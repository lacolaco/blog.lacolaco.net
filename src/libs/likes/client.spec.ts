import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('getOrCreateClientId', () => {
  const mockStorage = new Map<string, string>();

  beforeEach(() => {
    mockStorage.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage.get(key) ?? null,
      setItem: (key: string, value: string) => mockStorage.set(key, value),
    });
    vi.stubGlobal(
      'crypto',
      Object.assign({}, globalThis.crypto, {
        randomUUID: () => 'test-uuid-1234',
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('localStorage に既存IDがあればそれを返す', async () => {
    mockStorage.set('likes_client_id', 'existing-id');

    const { getOrCreateClientId } = await import('./client');
    expect(getOrCreateClientId()).toBe('existing-id');
  });

  it('localStorage に未存在ならUUID生成して保存・返却', async () => {
    const { getOrCreateClientId } = await import('./client');
    const id = getOrCreateClientId();

    expect(id).toBe('test-uuid-1234');
    expect(mockStorage.get('likes_client_id')).toBe('test-uuid-1234');
  });
});

describe('fetchLikeStatus', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ count: 5, liked: true }),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('正しいURLでGETリクエストを送信する', async () => {
    const { fetchLikeStatus } = await import('./client');
    const result = await fetchLikeStatus('test-slug', 'client-123');

    expect(fetch).toHaveBeenCalledWith('/api/likes/test-slug?clientId=client-123');
    expect(result).toEqual({ count: 5, liked: true });
  });

  it('clientIdが空の場合はクエリパラメータなし', async () => {
    const { fetchLikeStatus } = await import('./client');
    await fetchLikeStatus('test-slug', '');

    expect(fetch).toHaveBeenCalledWith('/api/likes/test-slug');
  });

  it('非OKレスポンスでエラーをスローする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const { fetchLikeStatus } = await import('./client');
    await expect(fetchLikeStatus('test-slug', 'client-123')).rejects.toThrow('Failed to fetch like status');
  });
});

describe('sendToggleLike', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('正しいボディでPOSTリクエストを送信する', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ count: 6, liked: true }),
      }),
    );

    const { sendToggleLike } = await import('./client');
    const result = await sendToggleLike('test-slug', 'client-123');

    expect(fetch).toHaveBeenCalledWith('/api/likes/test-slug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: 'client-123' }),
    });
    expect(result).toEqual({ count: 6, liked: true });
  });

  it('エラーレスポンスでエラーをスローする', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    const { sendToggleLike } = await import('./client');
    await expect(sendToggleLike('test-slug', 'client-123')).rejects.toThrow('Failed to toggle like');
  });
});

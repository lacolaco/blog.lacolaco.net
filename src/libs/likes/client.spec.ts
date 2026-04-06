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

  it('localStorage に有効なUUID v4があればそれを返す', async () => {
    mockStorage.set('likes_client_id', 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');

    const { getOrCreateClientId } = await import('./client');
    expect(getOrCreateClientId()).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
  });

  it('localStorage に不正な値があれば再生成して上書き', async () => {
    mockStorage.set('likes_client_id', 'invalid-not-uuid');

    const { getOrCreateClientId } = await import('./client');
    const id = getOrCreateClientId();

    expect(id).toBe('test-uuid-1234');
    expect(mockStorage.get('likes_client_id')).toBe('test-uuid-1234');
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

  it('X-Client-IdヘッダでGETリクエストを送信する', async () => {
    const { fetchLikeStatus } = await import('./client');
    const result = await fetchLikeStatus('test-slug', 'client-123');

    expect(fetch).toHaveBeenCalledWith('/api/likes/test-slug', {
      headers: { 'x-client-id': 'client-123' },
    });
    expect(result).toEqual({ count: 5, liked: true });
  });

  it('clientIdが空の場合はヘッダなし', async () => {
    const { fetchLikeStatus } = await import('./client');
    await fetchLikeStatus('test-slug', '');

    expect(fetch).toHaveBeenCalledWith('/api/likes/test-slug', { headers: {} });
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

  it('x-client-idヘッダでPOSTリクエストを送信する', async () => {
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
      headers: { 'x-client-id': 'client-123' },
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

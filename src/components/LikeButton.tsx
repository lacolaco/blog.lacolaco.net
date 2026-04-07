import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrCreateClientId, fetchLikeStatus, sendToggleLike } from '../libs/likes/client';
import { optimisticToggle, type LikeState } from '../libs/likes/optimistic';
import { createSlug } from '../libs/likes/constants';
import type { ClientId, Slug } from '../libs/likes/types';

type Variant = 'compact' | 'standard';

interface Props {
  slug: string;
  locale?: string;
  variant: Variant;
}

/** compact/standard間の状態同期用CustomEvent名 */
const SYNC_EVENT = 'like-state-sync';

/** パーティクルアニメーション時間（global.css の like-particle 0.6s と対応） */
const PARTICLE_DURATION_MS = 600;

interface LikeSyncDetail {
  slug: string;
  state: LikeState;
}

const i18n = {
  ja: { like: 'いいね', liked: 'いいね済み' },
  en: { like: 'Like', liked: 'Liked' },
};

/** localStorage不可時にcompact/standard間でclientIdを共有するためのモジュールレベルキャッシュ */
let cachedClientId: ClientId | null = null;
function getClientId(): ClientId {
  if (!cachedClientId) {
    cachedClientId = getOrCreateClientId();
  }
  return cachedClientId;
}

export default function LikeButton({ slug, locale = 'ja', variant }: Props) {
  const [state, setState] = useState<LikeState>({ count: 0, liked: false });
  const [loading, setLoading] = useState(true);
  const [showParticles, setShowParticles] = useState(false);
  const clientIdRef = useRef<ClientId | null>(null);
  const slugRef = useRef<Slug | null>(null);
  const isMounted = useRef(true);
  const isDispatching = useRef(false);
  const loadingRef = useRef(false);
  const particleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = locale === 'en' ? i18n.en : i18n.ja;

  // 初期化: clientId取得 + いいね状態フェッチ
  useEffect(() => {
    isMounted.current = true;

    try {
      slugRef.current = createSlug(slug);
    } catch {
      loadingRef.current = false;
      setLoading(false);
      return;
    }

    const clientId = getClientId();
    clientIdRef.current = clientId;

    loadingRef.current = true;
    fetchLikeStatus(slugRef.current, clientId)
      .then((result) => {
        if (isMounted.current) {
          setState({ count: result.count, liked: result.liked });
        }
      })
      .catch(() => {
        // 初期取得失敗: デフォルト状態のまま
      })
      .finally(() => {
        loadingRef.current = false;
        if (isMounted.current) {
          setLoading(false);
        }
      });

    return () => {
      isMounted.current = false;
      if (particleTimerRef.current) clearTimeout(particleTimerRef.current);
    };
  }, [slug]);

  // CustomEvent同期: 他インスタンスからの状態更新をリッスン
  useEffect(() => {
    const handler = (e: Event) => {
      // 自分がdispatchした場合はスキップ（dispatchEventは同期的に実行される）
      if (isDispatching.current) return;
      const detail = (e as CustomEvent<LikeSyncDetail>).detail;
      if (detail.slug === slug && isMounted.current) {
        setState(detail.state);
      }
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [slug]);

  /** 他インスタンスに状態を通知する */
  const dispatchSync = useCallback(
    (newState: LikeState) => {
      isDispatching.current = true;
      window.dispatchEvent(new CustomEvent<LikeSyncDetail>(SYNC_EVENT, { detail: { slug, state: newState } }));
      isDispatching.current = false;
    },
    [slug],
  );

  const handleToggle = useCallback(() => {
    if (loadingRef.current || !slugRef.current || !clientIdRef.current) return;

    const previousState = state;
    const newState = optimisticToggle(state);

    // 楽観的UI更新
    loadingRef.current = true;
    setState(newState);
    setLoading(true);
    dispatchSync(newState);

    // パーティクル（likeの場合のみ）
    if (newState.liked) {
      setShowParticles(true);
      if (particleTimerRef.current) clearTimeout(particleTimerRef.current);
      particleTimerRef.current = setTimeout(() => {
        particleTimerRef.current = null;
        if (isMounted.current) setShowParticles(false);
      }, PARTICLE_DURATION_MS);
    }

    sendToggleLike(slugRef.current, clientIdRef.current)
      .then((result) => {
        if (isMounted.current) {
          const serverState = { count: result.count, liked: result.liked };
          setState(serverState);
          dispatchSync(serverState);
        }
      })
      .catch(() => {
        // ロールバック
        if (isMounted.current) {
          setState(previousState);
          dispatchSync(previousState);
        }
      })
      .finally(() => {
        loadingRef.current = false;
        if (isMounted.current) {
          setLoading(false);
        }
      });
  }, [state, dispatchSync]);

  const ariaLabel = `${state.liked ? t.liked : t.like}${state.count > 0 ? ` (${state.count})` : ''}`;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={[
          'relative inline-flex items-center gap-1 p-1.5 lg:px-2 lg:py-1 rounded text-[13px] leading-[normal] no-underline transition-colors cursor-pointer border-0 bg-transparent',
          state.liked
            ? 'text-pink-500 hover:text-pink-600 hover:bg-pink-50'
            : 'text-muted lg:text-tertiary hover:text-default lg:hover:text-secondary hover:bg-gray-50 lg:hover:bg-surface',
        ].join(' ')}
        aria-label={ariaLabel}
        aria-pressed={state.liked}
      >
        <span
          className={[
            'inline-block w-5 h-5 lg:w-4 lg:h-4 transition-transform',
            state.liked ? 'icon-[mdi--heart] scale-110' : 'icon-[mdi--heart-outline]',
          ].join(' ')}
          aria-hidden="true"
        />
        {state.count > 0 && <span className="hidden lg:inline">{state.count}</span>}
        {showParticles && <ParticleEffect />}
      </button>
    );
  }

  // standard variant
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className={[
        'relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-colors cursor-pointer',
        state.liked
          ? 'text-pink-500 border border-pink-300 bg-pink-50 hover:bg-pink-100'
          : 'text-muted border border-gray-300 hover:text-default hover:border-gray-400 hover:bg-gray-50 bg-transparent',
      ].join(' ')}
      aria-label={ariaLabel}
      aria-pressed={state.liked}
    >
      <span
        className={[
          'inline-block w-5 h-5 transition-transform',
          state.liked ? 'icon-[mdi--heart] scale-110' : 'icon-[mdi--heart-outline]',
        ].join(' ')}
        aria-hidden="true"
      />
      <span>{state.liked ? t.liked : t.like}</span>
      {state.count > 0 && <span>{state.count}</span>}
      {showParticles && <ParticleEffect />}
    </button>
  );
}

/** いいね時のパーティクルアニメーション */
function ParticleEffect() {
  return (
    <span className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-pink-400 animate-like-particle"
          style={
            {
              '--particle-angle': `${i * 60}deg`,
              '--particle-distance': `${16 + (i % 3) * 4}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrCreateClientId, fetchLikeStatus, sendToggleLike } from '../libs/likes/client';
import { optimisticToggle, type LikeState } from '../libs/likes/optimistic';
import { createSlug } from '../libs/likes/constants';
import type { ClientId, LikeStatus, Slug } from '../libs/likes/types';

type Variant = 'compact' | 'standard';

/** 同一slug+clientIdの初期fetchを1本化するためのPromiseキャッシュ */
const fetchCache = new Map<string, Promise<LikeStatus>>();
function fetchLikeStatusOnce(slug: Slug, clientId: ClientId): Promise<LikeStatus> {
  const key = `${slug}:${clientId}`;
  if (!fetchCache.has(key)) {
    const promise = fetchLikeStatus(slug, clientId).finally(() => {
      fetchCache.delete(key);
    });
    fetchCache.set(key, promise);
  }
  return fetchCache.get(key)!;
}

interface Props {
  slug: string;
  locale?: string;
  variant: Variant;
}

/** compact/standard間の状態同期用CustomEvent名 */
const SYNC_EVENT = 'like-state-sync';

/** global.css の --like-particle-duration から取得 */
function getParticleDurationMs(): number {
  return parseInt(getComputedStyle(document.documentElement).getPropertyValue('--like-particle-duration'), 10) || 600;
}

interface LikeSyncDetail {
  slug: string;
  state: LikeState;
  loading: boolean;
}

const i18n = {
  ja: { like: 'いいね' },
  en: { like: 'Like' },
};

/** note.com実測値準拠の赤色（liked色、standardボーダー色） */
const ACCENT_COLOR = 'rgb(209, 62, 92)';
/** note.com実測値準拠のcompact unliked色 */
const COMPACT_UNLIKED_COLOR = 'rgba(8, 19, 26, 0.5)';
/** note.com実測値準拠のカウント色（liked状態に関わらず固定） */
const COUNT_COLOR = 'rgba(8, 19, 26, 0.66)';

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
  const stateRef = useRef(state);
  stateRef.current = state;
  const clientIdRef = useRef<ClientId | null>(null);
  const slugRef = useRef<Slug | null>(null);
  const isMounted = useRef(true);
  const isDispatching = useRef(false);
  const loadingRef = useRef(false);
  const particleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = locale === 'en' ? i18n.en : i18n.ja;

  // 初期化: clientId取得 + いいね状態フェッチ
  useEffect(() => {
    let active = true;
    isMounted.current = true;

    try {
      slugRef.current = createSlug(slug);
    } catch {
      slugRef.current = null;
      loadingRef.current = false;
      setLoading(false);
      return;
    }

    const clientId = getClientId();
    clientIdRef.current = clientId;

    loadingRef.current = true;
    setLoading(true);
    fetchLikeStatusOnce(slugRef.current, clientId)
      .then((result) => {
        if (active) {
          setState({ count: result.count, liked: result.liked });
        }
      })
      .catch(() => {
        // 初期取得失敗: デフォルト状態のまま
      })
      .finally(() => {
        if (active) {
          loadingRef.current = false;
          setLoading(false);
        }
      });

    return () => {
      active = false;
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
        loadingRef.current = detail.loading;
        setLoading(detail.loading);
      }
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, [slug]);

  /** 他インスタンスに状態を通知する */
  const dispatchSync = useCallback(
    (newState: LikeState, isLoading: boolean) => {
      isDispatching.current = true;
      window.dispatchEvent(
        new CustomEvent<LikeSyncDetail>(SYNC_EVENT, { detail: { slug, state: newState, loading: isLoading } }),
      );
      isDispatching.current = false;
    },
    [slug],
  );

  const handleToggle = useCallback(() => {
    if (loadingRef.current || !slugRef.current || !clientIdRef.current) return;

    const previousState = stateRef.current;
    const newState = optimisticToggle(stateRef.current);

    // 楽観的UI更新
    loadingRef.current = true;
    setState(newState);
    setLoading(true);
    dispatchSync(newState, true);

    // パーティクル（likeの場合のみ）
    if (newState.liked) {
      setShowParticles(true);
      if (particleTimerRef.current) clearTimeout(particleTimerRef.current);
      particleTimerRef.current = setTimeout(() => {
        particleTimerRef.current = null;
        if (isMounted.current) setShowParticles(false);
      }, getParticleDurationMs());
    }

    let finalState = newState;
    sendToggleLike(slugRef.current, clientIdRef.current)
      .then((result) => {
        finalState = { count: result.count, liked: result.liked };
        if (isMounted.current) {
          setState(finalState);
        }
      })
      .catch(() => {
        finalState = previousState;
        if (particleTimerRef.current) {
          clearTimeout(particleTimerRef.current);
          particleTimerRef.current = null;
        }
        if (isMounted.current) {
          setState(finalState);
          setShowParticles(false);
        }
      })
      .finally(() => {
        loadingRef.current = false;
        // 他インスタンスのloading解除は自身のunmount有無に関わらず実行
        dispatchSync(finalState, false);
        if (isMounted.current) {
          setLoading(false);
        }
      });
  }, [dispatchSync]);

  const ariaLabel = `${t.like} (${state.count})`;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className="inline-flex items-center gap-3 border-0 bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed"
        aria-label={ariaLabel}
        aria-pressed={state.liked}
      >
        <span className="relative">
          <span
            className={[
              'inline-block w-5 h-5 transition-transform',
              state.liked ? 'icon-[mdi--heart] scale-110' : 'icon-[mdi--heart-outline]',
            ].join(' ')}
            style={{ color: state.liked ? ACCENT_COLOR : COMPACT_UNLIKED_COLOR }}
            aria-hidden="true"
          />
          {showParticles && <ParticleEffect />}
        </span>
        <span className="text-[16px] leading-[normal]" style={{ color: COUNT_COLOR }}>
          {state.count}
        </span>
      </button>
    );
  }

  // standard variant: 40x40円形ボーダーコンテナ内にハートアイコンを中央配置
  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={loading}
      className="inline-flex items-center gap-3 border-0 bg-transparent p-0 cursor-pointer disabled:cursor-not-allowed"
      aria-label={ariaLabel}
      aria-pressed={state.liked}
    >
      <span
        className="relative inline-flex items-center justify-center w-10 h-10 rounded-full bg-white"
        style={{ border: `2px solid ${ACCENT_COLOR}` }}
      >
        <span
          className={[
            'inline-block w-5 h-5 transition-transform',
            state.liked ? 'icon-[mdi--heart] scale-110' : 'icon-[mdi--heart-outline]',
          ].join(' ')}
          style={{ color: ACCENT_COLOR }}
          aria-hidden="true"
        />
        {showParticles && <ParticleEffect />}
      </span>
      <span className="text-[16px] leading-[normal]" style={{ color: COUNT_COLOR }}>
        {state.count}
      </span>
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

import { useState, useEffect, useCallback, useRef } from 'react';
import { getOrCreateClientId, fetchLikeStatus, sendToggleLike } from '../libs/likes/client';
import { trackEvent, likeEvents } from '../libs/analytics';

interface Props {
  slug: string;
  /** compact: タイトル下（高さ20px, gap 12px）, standard: 記事下（高さ40px, gap 22px） */
  variant?: 'compact' | 'standard';
}

/** CustomEventの型 */
interface LikeToggleDetail {
  slug: string;
  count: number;
  liked: boolean;
  source: string;
}

const LIKE_EVENT_NAME = 'like-toggle';

/** パーティクルの色パレット */
const PARTICLE_COLORS = ['#d13e5c', '#ff6b8a', '#ffd700', '#ff8c42', '#7b68ee', '#00c9a7'];

/** パーティクルの形状 */
type ParticleShape = 'circle' | 'heart';

interface Particle {
  id: number;
  angle: number;
  distance: number;
  color: string;
  shape: ParticleShape;
  size: number;
}

function generateParticles(): Particle[] {
  const count = 8 + Math.floor(Math.random() * 5); // 8-12個
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    angle: (360 / count) * i + (Math.random() - 0.5) * 30,
    distance: 20 + Math.random() * 15,
    color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
    shape: Math.random() > 0.5 ? 'circle' : 'heart',
    size: 4 + Math.random() * 4,
  }));
}

function FireworkParticles({ onComplete }: { onComplete: () => void }) {
  const [particles] = useState(generateParticles);

  useEffect(() => {
    const timer = setTimeout(onComplete, 600);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'visible',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {particles.map((p) => {
        const rad = (p.angle * Math.PI) / 180;
        const dx = Math.cos(rad) * p.distance;
        const dy = Math.sin(rad) * p.distance;

        return (
          <span
            key={p.id}
            style={
              {
                position: 'absolute',
                width: `${p.size}px`,
                height: `${p.size}px`,
                '--dx': `${dx}px`,
                '--dy': `${dy}px`,
                backgroundColor: p.shape === 'circle' ? p.color : 'transparent',
                borderRadius: p.shape === 'circle' ? '50%' : undefined,
                color: p.color,
                animation: 'firework-particle 600ms ease-out forwards',
              } as React.CSSProperties
            }
          >
            {p.shape === 'heart' && (
              <svg viewBox="0 0 24 24" width={p.size} height={p.size}>
                <path
                  d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
                  fill="currentColor"
                />
              </svg>
            )}
          </span>
        );
      })}
    </div>
  );
}

/** ハートアイコン（アウトライン） */
function HeartOutline() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

/** ハートアイコン（塗りつぶし） */
function HeartFilled() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

/** variant別スタイル定数（note.com実測値） */
const VARIANT_STYLES = {
  compact: { height: '20px', gap: '12px' },
  standard: { height: '40px', gap: '22px' },
} as const;

export default function LikeButton({ slug, variant = 'compact' }: Props) {
  const [count, setCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);
  const isMounted = useRef(true);
  const instanceId = useRef(crypto.randomUUID());
  const clientIdRef = useRef<string>('');
  const isTogglingRef = useRef(false);

  const styles = VARIANT_STYLES[variant];

  // 初期取得
  useEffect(() => {
    isMounted.current = true;

    const init = async () => {
      try {
        const clientId = getOrCreateClientId();
        clientIdRef.current = clientId;
        const status = await fetchLikeStatus(slug, clientId);
        if (isMounted.current) {
          setCount(status.count);
          setLiked(status.liked);
          setIsLoading(false);
        }
      } catch {
        if (isMounted.current) {
          setIsLoading(false);
        }
      }
    };

    void init();

    return () => {
      isMounted.current = false;
    };
  }, [slug]);

  // 他のLikeButtonインスタンスからの同期イベントを受信
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<LikeToggleDetail>).detail;
      if (detail.slug === slug && detail.source !== instanceId.current) {
        setCount(detail.count);
        setLiked(detail.liked);
      }
    };

    window.addEventListener(LIKE_EVENT_NAME, handler);
    return () => window.removeEventListener(LIKE_EVENT_NAME, handler);
  }, [slug]);

  const handleToggle = useCallback(async () => {
    if (isLoading || isTogglingRef.current) return;
    isTogglingRef.current = true;

    // 楽観的UI更新
    const prevCount = count;
    const prevLiked = liked;
    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : Math.max(0, count - 1);

    setLiked(newLiked);
    setCount(newCount);

    if (newLiked) {
      setIsAnimating(true);
    }

    // Analytics
    trackEvent(likeEvents.toggle(newLiked ? 'like' : 'unlike', slug));

    try {
      const result = await sendToggleLike(slug, clientIdRef.current);
      if (isMounted.current) {
        setCount(result.count);
        setLiked(result.liked);

        // 同期イベント発行
        window.dispatchEvent(
          new CustomEvent<LikeToggleDetail>(LIKE_EVENT_NAME, {
            detail: {
              slug,
              count: result.count,
              liked: result.liked,
              source: instanceId.current,
            },
          }),
        );
      }
    } catch {
      // ロールバック
      if (isMounted.current) {
        setCount(prevCount);
        setLiked(prevLiked);
        setIsAnimating(false);
      }
    } finally {
      isTogglingRef.current = false;
    }
  }, [isLoading, count, liked, slug]);

  const handleAnimationComplete = useCallback(() => {
    setIsAnimating(false);
  }, []);

  return (
    <button
      type="button"
      onClick={() => void handleToggle()}
      disabled={isLoading}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: styles.height,
        gap: styles.gap,
        color: liked ? '#d13e5c' : 'rgba(8, 19, 26, 0.5)',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: isLoading ? 'default' : 'pointer',
        opacity: isLoading ? 0.5 : 1,
        transition: 'color 0.2s',
        lineHeight: 1,
      }}
      aria-label={liked ? 'スキを取り消す' : 'スキ'}
    >
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        {liked ? <HeartFilled /> : <HeartOutline />}
        {isAnimating && <FireworkParticles onComplete={handleAnimationComplete} />}
      </span>
      <span style={{ color: 'rgba(8, 19, 26, 0.66)', fontSize: '16px' }}>
        {isLoading ? '-' : count.toLocaleString()}
      </span>
    </button>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackEvent } from '../libs/analytics';

type LikeState = 'loading' | 'idle' | 'liked' | 'error';

type Props = {
  slug: string;
};

const CLIENT_ID_KEY = 'blog_like_client_id';
const LIKE_COLOR = '#d13e5c';

// カスタムイベント名（同一ページ内の2つのLikeButton間で同期）
const LIKE_SYNC_EVENT = 'like-sync';

type LikeSyncDetail = {
  slug: string;
  count: number;
  liked: boolean;
  source: string; // 発火元のインスタンスID
};

function getClientId(): string {
  let id = localStorage.getItem(CLIENT_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(CLIENT_ID_KEY, id);
  }
  return id;
}

// 花火パーティクルアニメーション
function spawnParticles(container: HTMLElement) {
  const colors = [LIKE_COLOR, '#ff6b9d', '#ffa726', '#ab47bc', '#42a5f5', '#66bb6a'];
  const shapes = ['●', '★', '♥'];
  const count = 8;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const distance = 20 + Math.random() * 20;
    const size = 8 + Math.random() * 6;

    particle.textContent = shape;
    particle.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      font-size: ${size}px;
      color: ${color};
      pointer-events: none;
      z-index: 10;
      transform: translate(-50%, -50%);
      animation: like-particle 600ms ease-out forwards;
      --dx: ${Math.cos(angle) * distance}px;
      --dy: ${Math.sin(angle) * distance}px;
    `;
    container.appendChild(particle);

    setTimeout(() => particle.remove(), 700);
  }
}

// CSS keyframesを一度だけ挿入
let stylesInjected = false;
function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes like-particle {
      0% {
        opacity: 1;
        transform: translate(-50%, -50%) translate(0, 0) scale(1);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -50%) translate(var(--dx), var(--dy)) scale(0.3);
      }
    }
    @keyframes like-heart-pop {
      0% { transform: scale(1); }
      50% { transform: scale(1.3); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(style);
}

// ハートSVG
function HeartIcon({ filled, className }: { filled: boolean; className?: string }) {
  if (filled) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill={LIKE_COLOR}
        className={className}
        aria-hidden="true"
      >
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
    </svg>
  );
}

export default function LikeButton({ slug }: Props) {
  const [state, setState] = useState<LikeState>('loading');
  const [count, setCount] = useState(0);
  const [animating, setAnimating] = useState(false);
  const containerRef = useRef<HTMLButtonElement>(null);
  const instanceId = useRef(crypto.randomUUID());
  const isMounted = useRef(true);

  useEffect(() => {
    injectStyles();
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // 初期取得
  useEffect(() => {
    const clientId = getClientId();
    fetch(`/api/likes/${encodeURIComponent(slug)}?clientId=${encodeURIComponent(clientId)}`)
      .then((res) => res.json() as Promise<{ count: number; liked: boolean }>)
      .then((data) => {
        if (!isMounted.current) return;
        setCount(data.count);
        setState(data.liked ? 'liked' : 'idle');
      })
      .catch(() => {
        if (!isMounted.current) return;
        setState('error');
      });
  }, [slug]);

  // 他のLikeButtonからの同期イベントを受信
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<LikeSyncDetail>).detail;
      if (detail.slug === slug && detail.source !== instanceId.current) {
        setCount(detail.count);
        setState(detail.liked ? 'liked' : 'idle');
      }
    };
    window.addEventListener(LIKE_SYNC_EVENT, handler);
    return () => window.removeEventListener(LIKE_SYNC_EVENT, handler);
  }, [slug]);

  const handleClick = useCallback(async () => {
    if (state === 'loading') return;

    const wasLiked = state === 'liked';
    const prevCount = count;

    // 楽観的UI更新
    const newLiked = !wasLiked;
    const newCount = wasLiked ? Math.max(0, count - 1) : count + 1;
    setState(newLiked ? 'liked' : 'idle');
    setCount(newCount);

    // スキ時のアニメーション
    if (newLiked && containerRef.current) {
      setAnimating(true);
      spawnParticles(containerRef.current);
      setTimeout(() => setAnimating(false), 400);
    }

    // 同期イベント発火
    window.dispatchEvent(
      new CustomEvent<LikeSyncDetail>(LIKE_SYNC_EVENT, {
        detail: { slug, count: newCount, liked: newLiked, source: instanceId.current },
      }),
    );

    // Analytics
    trackEvent({
      name: 'like_toggle',
      params: { action: newLiked ? 'like' : 'unlike', slug },
    });

    // API呼び出し
    try {
      const clientId = getClientId();
      const res = await fetch(`/api/likes/${encodeURIComponent(slug)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as { count: number; liked: boolean };
      if (!isMounted.current) return;

      // サーバーの実際の値で補正
      setCount(data.count);
      setState(data.liked ? 'liked' : 'idle');

      // 同期イベント再発火（サーバー値で補正）
      window.dispatchEvent(
        new CustomEvent<LikeSyncDetail>(LIKE_SYNC_EVENT, {
          detail: { slug, count: data.count, liked: data.liked, source: instanceId.current },
        }),
      );
    } catch {
      if (!isMounted.current) return;
      // ロールバック
      setCount(prevCount);
      setState(wasLiked ? 'liked' : 'idle');
    }
  }, [state, count, slug]);

  const isLiked = state === 'liked';

  return (
    <button
      ref={containerRef}
      type="button"
      onClick={() => void handleClick()}
      disabled={state === 'loading'}
      className="relative inline-flex items-center gap-1.5 cursor-pointer border-0 bg-transparent p-0 transition-colors group"
      style={{ color: isLiked ? LIKE_COLOR : undefined }}
      aria-label={isLiked ? 'スキを取り消す' : 'スキ'}
      aria-pressed={isLiked}
    >
      <span
        className="inline-block w-5 h-5 lg:w-6 lg:h-6"
        style={animating ? { animation: 'like-heart-pop 400ms ease-out' } : undefined}
      >
        <HeartIcon filled={isLiked} className="w-full h-full" />
      </span>
      <span
        className={`text-xs lg:text-sm tabular-nums leading-none ${isLiked ? '' : 'text-muted group-hover:text-default'}`}
      >
        {state === 'loading' ? '-' : count}
      </span>
    </button>
  );
}

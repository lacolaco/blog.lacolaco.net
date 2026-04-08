import type { LikeStatus } from './types';

/** UIコンポーネント内で使用する状態型。LikeStatusと同一 */
export type LikeState = LikeStatus;

/** 楽観的UIのための状態トグル。元の状態を変更しない */
export function optimisticToggle(state: LikeState): LikeState {
  return state.liked ? { count: Math.max(0, state.count - 1), liked: false } : { count: state.count + 1, liked: true };
}

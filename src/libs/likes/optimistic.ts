export type LikeState = { count: number; liked: boolean };

/** 楽観的UIのための状態トグル。元の状態を変更しない */
export function optimisticToggle(state: LikeState): LikeState {
  return state.liked ? { count: Math.max(0, state.count - 1), liked: false } : { count: state.count + 1, liked: true };
}

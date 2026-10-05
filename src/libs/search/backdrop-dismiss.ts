export type Rect = { left: number; top: number; right: number; bottom: number };

/** 座標が矩形の外か。モーダルの dialog 要素は ::backdrop への操作でも event.target になるので、座標で背景かを見分ける */
export function isOutsideRect(rect: Rect, x: number, y: number): boolean {
  return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
}

/**
 * 背景 (::backdrop) の操作で閉じるかを、押した位置と離した位置から決める。
 * 両方が背景のときだけ閉じる。click は押した位置と離した位置の共通の祖先 (dialog) が target になるので、
 * モーダル内で押して外で離した操作 (文字の選択など) でも閉じてしまい、click では判定できない。
 * `<dialog closedby="any">` と同じ規則 (WHATWG HTML の Dialog light dismiss) で、未対応のブラウザの代替に使う。
 */
export function createBackdropDismiss() {
  let armed = false;
  return {
    down(onBackdrop: boolean) {
      armed = onBackdrop;
    },
    /** 閉じるなら true。離したら記録は消す */
    up(onBackdrop: boolean): boolean {
      const close = armed && onBackdrop;
      armed = false;
      return close;
    },
    /** pointercancel (タッチでスクロールが始まったときなど) */
    cancel() {
      armed = false;
    },
  };
}

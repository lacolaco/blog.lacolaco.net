import { describe, expect, it } from 'vitest';
import { createBackdropDismiss, isOutsideRect } from './backdrop-dismiss';

describe('isOutsideRect', () => {
  const rect = { left: 100, top: 80, right: 660, bottom: 700 };
  it('矩形の内側は外ではない (縁を含む)', () => {
    expect(isOutsideRect(rect, 300, 300)).toBe(false);
    expect(isOutsideRect(rect, 100, 80)).toBe(false);
    expect(isOutsideRect(rect, 660, 700)).toBe(false);
  });
  it('矩形の外側は外', () => {
    expect(isOutsideRect(rect, 99, 300)).toBe(true);
    expect(isOutsideRect(rect, 300, 79)).toBe(true);
    expect(isOutsideRect(rect, 661, 300)).toBe(true);
    expect(isOutsideRect(rect, 300, 701)).toBe(true);
  });
});

describe('createBackdropDismiss', () => {
  it('背景で押して背景で離したときだけ閉じる', () => {
    const d = createBackdropDismiss();
    d.down(true);
    expect(d.up(true)).toBe(true);
  });
  it('モーダル内で押して背景で離しても閉じない (文字の選択やカードのドラッグ)', () => {
    const d = createBackdropDismiss();
    d.down(false);
    expect(d.up(true)).toBe(false);
  });
  it('背景で押してモーダル内で離しても閉じない', () => {
    const d = createBackdropDismiss();
    d.down(true);
    expect(d.up(false)).toBe(false);
  });
  it('押さずに離しただけでは閉じない', () => {
    expect(createBackdropDismiss().up(true)).toBe(false);
  });
  it('離したあとは押した記録を持ち越さない', () => {
    const d = createBackdropDismiss();
    d.down(true);
    d.up(true);
    expect(d.up(true)).toBe(false);
  });
  it('押している途中の取り消し (スクロールの開始など) では閉じない', () => {
    const d = createBackdropDismiss();
    d.down(true);
    d.cancel();
    expect(d.up(true)).toBe(false);
  });
  it('新しく押したときに前の記録を上書きする', () => {
    const d = createBackdropDismiss();
    d.down(true);
    d.down(false);
    expect(d.up(true)).toBe(false);
  });
});

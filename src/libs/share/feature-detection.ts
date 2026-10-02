import type { ShareAvailability } from './types';

/**
 * Web Share API の利用可能性を確認
 *
 * navigator.canShare() は判定に使わない。共有するのは title / url のみで、
 * navigator.share が存在する環境では canShare も常に true を返すため。
 */
export function checkShareAvailability(): ShareAvailability {
  if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
    return 'unavailable';
  }
  return 'available';
}

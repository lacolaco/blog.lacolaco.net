import { checkShareAvailability } from './feature-detection';
import type { ShareContent, ShareResult } from './types';

/**
 * ユーザーが共有シートを閉じたときのエラーか判定する
 * DOMException / Error のどちらで投げられても name で判定できるようにする
 */
function isAbortError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError';
}

/**
 * Web Share API でコンテンツを共有する
 * 呼び出しはユーザー操作（クリック等）のハンドラ内から行う必要がある
 */
export async function shareContent(content: ShareContent): Promise<ShareResult> {
  if (checkShareAvailability() === 'unavailable') {
    return { status: 'unavailable' };
  }

  try {
    await navigator.share({ title: content.title, url: content.url });
    return { status: 'success' };
  } catch (error) {
    // ユーザーによるキャンセルは AbortError になるためエラーとして扱わない
    if (isAbortError(error)) {
      return { status: 'cancelled' };
    }
    return { status: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}

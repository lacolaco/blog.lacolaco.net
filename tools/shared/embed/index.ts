/**
 * 埋め込み関連のユーティリティ関数
 */

/**
 * URLがTwitter/X の投稿URLかどうかを判定する
 * @param url 判定対象のURL
 * @returns Twitter/X投稿URLの場合はtrue、そうでなければfalse
 */
export function isTweetUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();

    // twitter.com または x.com のドメインをチェック
    const isTwitterDomain =
      hostname === 'twitter.com' || hostname === 'www.twitter.com' || hostname === 'x.com' || hostname === 'www.x.com';

    if (!isTwitterDomain) {
      return false;
    }

    // /user/status/tweetId の形式をチェック
    const pathMatch = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)$/);
    return pathMatch !== null;
  } catch {
    return false;
  }
}

/**
 * URLがMisskeyのノートURL(https://<host>/notes/<id>)の形式かどうかを判定する
 * 実際にMisskeyかどうかは判定せず、形式のみを見る
 * @param url 判定対象のURL
 * @returns ノートURLの形式の場合はtrue、そうでなければfalse
 */
export function isMisskeyNoteUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'https:' && /^\/notes\/[a-zA-Z0-9]+$/.test(urlObj.pathname);
  } catch {
    return false;
  }
}

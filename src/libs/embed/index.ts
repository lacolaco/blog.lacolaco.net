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
 * URLからツイートIDを抽出する
 * @param url Twitter/X投稿URL
 * @returns ツイートID、抽出できない場合はnull
 */
export function extractTweetId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)$/);
    return pathMatch ? pathMatch[2] : null;
  } catch {
    return null;
  }
}

/**
 * URLからTwitterユーザー名を抽出する
 * @param url Twitter/X投稿URL
 * @returns ユーザー名、抽出できない場合はnull
 */
export function extractTwitterUsername(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/^\/([^/]+)\/status\/(\d+)$/);
    return pathMatch ? pathMatch[1] : null;
  } catch {
    return null;
  }
}

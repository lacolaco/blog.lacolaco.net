/** slugのバリデーション正規表現 */
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
/** slugの最大長 */
export const SLUG_MAX_LENGTH = 200;

/** clientIdがFirestoreフィールドパスとして安全な文字種かを検証するパターン */
const CLIENT_ID_PATTERN = /^[0-9a-f-]{1,128}$/i;

export function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length > SLUG_MAX_LENGTH) {
    throw new Error(`不正なslug: ${slug}`);
  }
}

/** clientIdの形式が有効かを返す */
export function isValidClientId(clientId: string): boolean {
  return clientId.length > 0 && CLIENT_ID_PATTERN.test(clientId);
}

/** clientIdの形式を検証する。無効な場合はエラーをスロー */
export function validateClientId(clientId: string): void {
  if (!clientId) {
    throw new Error('clientIdは必須です');
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error(`不正なclientId形式: ${clientId}`);
  }
}

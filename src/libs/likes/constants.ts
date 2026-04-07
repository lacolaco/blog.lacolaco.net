/** slugのバリデーション正規表現 */
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
/** slugの最大長 */
export const SLUG_MAX_LENGTH = 200;
/**
 * clientIdの許可文字パターン（hex + ハイフン、最大128文字）。
 * 意図的にUUID v4形式より緩い文字種チェックを採用している。
 * 理由: clientIdはcrypto.randomUUID()で生成されるため形式は実質UUID v4だが、
 * バリデーションの目的はFirestoreフィールドパスに安全な文字種の保証であり、
 * UUID v4の構造検証ではない。
 */
export const CLIENT_ID_PATTERN = /^[0-9a-f-]{1,128}$/i;

export function validateSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug) || slug.length > SLUG_MAX_LENGTH) {
    throw new Error(`不正なslug: ${slug}`);
  }
}

export function validateClientId(clientId: string): void {
  if (!clientId) {
    throw new Error('clientIdは必須です');
  }
  if (!CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error(`不正なclientId形式: ${clientId}`);
  }
}

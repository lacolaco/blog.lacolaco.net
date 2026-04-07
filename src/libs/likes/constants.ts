import type { ClientId, Slug } from './types';

/** slugのバリデーション正規表現 */
export const SLUG_PATTERN = /^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/;
/** slugの最大長 */
export const SLUG_MAX_LENGTH = 200;

/** clientIdがFirestoreフィールドパスとして安全な文字種かを検証するパターン */
const CLIENT_ID_PATTERN = /^[0-9a-f-]{1,128}$/i;

/** slugの形式が有効かを返す */
export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && slug.length <= SLUG_MAX_LENGTH;
}

/** clientIdの形式が有効かを返す */
export function isValidClientId(clientId: string): boolean {
  return CLIENT_ID_PATTERN.test(clientId);
}

/** 生文字列からSlugを生成する。無効な場合はエラーをスロー */
export function createSlug(raw: string): Slug {
  if (!isValidSlug(raw)) {
    throw new Error(`不正なslug: ${raw}`);
  }
  return raw as Slug;
}

/** 生文字列からClientIdを生成する。無効な場合はエラーをスロー */
export function createClientId(raw: string): ClientId {
  if (!raw) {
    throw new Error('clientIdは必須です');
  }
  if (!CLIENT_ID_PATTERN.test(raw)) {
    throw new Error(`不正なclientId形式: ${raw}`);
  }
  return raw as ClientId;
}

/** 生文字列をClientIdとして検証し、有効ならClientIdを返す。無効ならnull */
export function tryCreateClientId(raw: string): ClientId | null {
  if (!raw || !CLIENT_ID_PATTERN.test(raw)) {
    return null;
  }
  return raw as ClientId;
}

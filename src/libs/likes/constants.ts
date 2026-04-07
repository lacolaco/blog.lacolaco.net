import { ClientId, Slug } from './types';

/** slugの形式が有効かを返す */
export function isValidSlug(value: string): boolean {
  return Slug.safeParse(value).success;
}

/** clientIdの形式が有効かを返す */
export function isValidClientId(value: string): boolean {
  return ClientId.safeParse(value).success;
}

/** 生文字列からSlugを生成する。無効な場合はエラーをスロー */
export function createSlug(raw: string): Slug {
  return Slug.parse(raw);
}

/** 生文字列からClientIdを生成する。無効な場合はエラーをスロー */
export function createClientId(raw: string): ClientId {
  return ClientId.parse(raw);
}

/** 生文字列をClientIdとして検証し、有効ならClientIdを返す。無効ならnull */
export function tryCreateClientId(raw: string): ClientId | null {
  const result = ClientId.safeParse(raw);
  return result.success ? result.data : null;
}

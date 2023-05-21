import type { Readable } from 'node:stream';
import { request } from 'undici';

export async function getFile(url: string): Promise<Readable> {
  const resp = await request(new URL(url));
  return resp.body;
}

export async function getJSON<T>(url: string): Promise<T> {
  const resp = await request(new URL(url));
  return await resp.body.json();
}
export function isNotNull<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

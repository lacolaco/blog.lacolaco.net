import { Readable } from 'node:stream';
import { request } from 'undici';

export async function getFile(url: string): Promise<Readable> {
  const resp = await request(new URL(url));
  return resp.body;
}

import { Storage } from '@google-cloud/storage';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

const storage = new Storage();

// Assert mandatory environment variable
const bucketName = process.env.GCS_BUCKET_NAME;
if (!bucketName) {
  throw new Error('GCS_BUCKET_NAME is not set.');
}

/**
 * OG画像のキャッシュキーを生成する
 * spec: {slug}-{sha256(slug + title)}
 * 同じ記事でもタイトルが変わったらキャッシュを更新するためにタイトルも含める
 *
 * @param slug 記事ID(slug)
 * @param title 記事タイトル
 * @returns
 */
function getCacheKey(slug: string, title: string): string {
  const hash = createHash('sha256').update(`${slug}-${title}`).digest('hex');
  return `${slug}-${hash}`;
}

export async function getCachedImage(slug: string, title: string): Promise<Buffer | null> {
  const bucket = storage.bucket(bucketName);
  const cacheKey = getCacheKey(slug, title);
  const fileName = `${cacheKey}.png`;
  const file = bucket.file(fileName);

  try {
    const [exists] = await file.exists();
    if (exists) {
      const [buffer] = await file.download();
      return buffer;
    }
  } catch (error) {
    console.error(error);
  }
  return null;
}

export async function cacheImage(slug: string, title: string, buffer: Uint8Array): Promise<void> {
  const bucket = storage.bucket(bucketName);
  const cacheKey = getCacheKey(slug, title);
  const fileName = `${cacheKey}.png`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: {
      contentType: 'image/png',
    },
  });
}

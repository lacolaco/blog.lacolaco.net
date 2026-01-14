/**
 * R2へ画像をsyncするスクリプト
 *
 * 必要な環境変数:
 *   CLOUDFLARE_ACCOUNT_ID - CloudflareアカウントID
 *   R2_ACCESS_KEY_ID - R2 APIトークンのアクセスキーID
 *   R2_SECRET_ACCESS_KEY - R2 APIトークンのシークレットアクセスキー
 *   R2_BUCKET_NAME - R2バケット名
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { lookup } from 'mime-types';
import { createHash } from 'node:crypto';

// 環境変数の型定義
interface Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
}

function loadConfig(): Config {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID is not set');
  }
  if (!accessKeyId) {
    throw new Error('R2_ACCESS_KEY_ID is not set');
  }
  if (!secretAccessKey) {
    throw new Error('R2_SECRET_ACCESS_KEY is not set');
  }
  if (!bucketName) {
    throw new Error('R2_BUCKET_NAME is not set');
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName };
}

function createS3Client(config: Config): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

async function shouldUpload(client: S3Client, bucketName: string, key: string, localETag: string): Promise<boolean> {
  try {
    const response = await client.send(
      new HeadObjectCommand({
        Bucket: bucketName,
        Key: key,
      }),
    );
    // ETagが一致する場合はスキップ（R2のETagはダブルクォートで囲まれている）
    const remoteETag = response.ETag?.replace(/"/g, '');
    return remoteETag !== localETag;
  } catch {
    // オブジェクトが存在しない場合はアップロード
    return true;
  }
}

async function uploadFile(client: S3Client, bucketName: string, filePath: string, key: string): Promise<boolean> {
  const content = await readFile(filePath);
  const contentType = lookup(filePath) || 'application/octet-stream';
  const localETag = createHash('md5').update(content).digest('hex');

  // 変更がない場合はスキップ
  if (!(await shouldUpload(client, bucketName, key, localETag))) {
    return false;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: content,
      ContentType: contentType,
    }),
  );

  return true;
}

async function main(): Promise<void> {
  const sourceDir = process.argv[2] ?? 'public/images';

  // ソースディレクトリの存在確認
  try {
    const stats = await stat(sourceDir);
    if (!stats.isDirectory()) {
      console.error(`Error: ${sourceDir} is not a directory`);
      process.exit(1);
    }
  } catch {
    console.log(`Warning: Source directory does not exist: ${sourceDir}`);
    process.exit(0);
  }

  const config = loadConfig();
  const client = createS3Client(config);

  console.log(`Syncing images from ${sourceDir} to R2 bucket: ${config.bucketName}`);

  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for await (const filePath of walkDir(sourceDir)) {
    // キーは {slug}/xxx.png の形式（images.blog.lacolaco.net/{slug}/xxx.png となる）
    const relativePath = relative(sourceDir, filePath);
    const key = relativePath;

    try {
      const uploaded = await uploadFile(client, config.bucketName, filePath, key);
      if (uploaded) {
        console.log(`Uploaded: ${key}`);
        uploadedCount++;
      } else {
        skippedCount++;
      }
    } catch (error) {
      console.error(`Error uploading ${key}:`, error);
      errorCount++;
    }
  }

  console.log(`\nSync completed: ${uploadedCount} uploaded, ${skippedCount} skipped, ${errorCount} errors`);

  if (errorCount > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

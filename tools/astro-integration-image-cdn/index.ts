import type { AstroIntegration } from 'astro';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * 画像URLを外部CDNに書き換えるAstro integration
 *
 * 環境変数 IMAGE_CDN_BASE_URL が設定されている場合、
 * ビルド後のHTMLで /images/ で始まる画像パスを外部URLに書き換える
 *
 * 例: IMAGE_CDN_BASE_URL=https://images.blog.lacolaco.net
 *     /images/foo/bar.png → https://images.blog.lacolaco.net/foo/bar.png
 */

interface ImageCdnIntegrationOptions {
  baseUrl?: string;
}

async function* walkDir(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walkDir(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield fullPath;
    }
  }
}

export function imageCdnIntegration(options: ImageCdnIntegrationOptions = {}): AstroIntegration {
  const baseUrl = options.baseUrl || process.env.IMAGE_CDN_BASE_URL;

  return {
    name: 'astro-integration-image-cdn',
    hooks: {
      'astro:build:done': async ({ dir }) => {
        // baseUrlが設定されていない場合は何もしない
        if (!baseUrl) {
          console.log('[image-cdn] IMAGE_CDN_BASE_URL not set, skipping URL transformation');
          return;
        }

        // 末尾のスラッシュを除去
        const normalizedBaseUrl = baseUrl.replace(/\/$/, '');

        // /images/で始まるパスを変換する正規表現
        const imageUrlPattern = /(src=["'])(\/images\/[^"']+)(["'])/g;

        // Astro 5ではdirはURL形式でfileURLToPathで変換が必要
        // dir.pathnameはfile:///path/to/dist/client/ -> /path/to/dist/client/のように変換される
        const clientDir = dir.pathname;
        let transformedCount = 0;
        let fileCount = 0;

        console.log(`[image-cdn] Transforming image URLs to ${normalizedBaseUrl}`);

        for await (const htmlPath of walkDir(clientDir)) {
          const html = await readFile(htmlPath, 'utf-8');

          // 変換前にマッチ数をカウント
          const matches = html.match(imageUrlPattern);
          if (!matches) {
            continue;
          }

          transformedCount += matches.length;

          const transformedHtml = html.replace(
            imageUrlPattern,
            (_match: string, prefix: string, imagePath: string, suffix: string) => {
              // /images/ プレフィックスを除去してCDN URLに変換
              const cdnPath = imagePath.replace('/images', '');
              return `${prefix}${normalizedBaseUrl}${cdnPath}${suffix}`;
            },
          );

          await writeFile(htmlPath, transformedHtml, 'utf-8');
          fileCount++;
        }

        console.log(`[image-cdn] Transformed ${transformedCount} image URLs in ${fileCount} files`);
      },
    },
  };
}

export default imageCdnIntegration;

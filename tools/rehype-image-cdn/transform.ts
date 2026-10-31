import { imageSize } from 'image-size';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const SRCSET_WIDTHS = [480, 768, 1024, 1536];
const SIZES = '(min-width: 768px) 768px, calc(100vw - 32px)';
const RESIZABLE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

export interface ImageCdnOptions {
  baseUrl?: string;
  publicDir?: string;
}

type Properties = Record<string, unknown>;

/**
 * img / video 要素の properties を CDN 向けに書き換えるための差分を返す変換を作る。
 * unified (rehype) と Sätteri のどちらのプラグインからも同じ変換を使う。
 * 戻り値は上書きする properties のみで、書き換え対象でなければ undefined
 */
export function createImageCdnTransform(options: ImageCdnOptions = {}) {
  const baseUrl = (options.baseUrl || process.env.IMAGE_CDN_BASE_URL)?.replace(/\/$/, '');
  const publicDir = options.publicDir || join(process.cwd(), 'public');
  const dimensionCache = new Map<string, { width: number; height: number } | null>();

  return (tagName: string, properties: Properties): Properties | undefined => {
    if (tagName === 'img') {
      const src = properties.src;
      if (typeof src !== 'string' || !src.startsWith('/images/')) return;

      const updates: Properties = {};
      const ext = extname(new URL(src, 'http://x').pathname).toLowerCase();
      const cdnPath = src.slice('/images'.length);

      // width/height（CLS 防止）
      const filePath = join(publicDir, decodeURIComponent(src));
      if (!dimensionCache.has(filePath)) {
        try {
          // image-size v2 はファイルパスを受け付けない（Buffer/Uint8Array のみ）
          const dimensions = imageSize(readFileSync(filePath));
          dimensionCache.set(
            filePath,
            dimensions.width && dimensions.height ? { width: dimensions.width, height: dimensions.height } : null,
          );
        } catch {
          console.warn(`[rehype-image-cdn] Could not read image: ${filePath}`);
          dimensionCache.set(filePath, null);
        }
      }
      const cached = dimensionCache.get(filePath);
      if (cached) {
        updates.width = cached.width;
        updates.height = cached.height;
      }

      // loading/decoding
      if (!properties.loading) {
        updates.loading = 'lazy';
      }
      if (!properties.decoding) {
        updates.decoding = 'async';
      }

      // CDN URL が設定されている場合のみ
      if (!baseUrl) return updates;

      // src → raw CDN URL
      updates.src = `${baseUrl}${cdnPath}`;

      // srcset/sizes はリサイズ可能な形式のみ
      if (RESIZABLE_EXTENSIONS.has(ext)) {
        updates.srcSet = SRCSET_WIDTHS.map(
          (w) => `${baseUrl}/cdn-cgi/image/width=${w},format=auto${cdnPath} ${w}w`,
        ).join(', ');
        updates.sizes = SIZES;
      }
      return updates;
    }

    // 動画は notion-sync が `/videos/{slug}/{filename}` 相対パスで markdown を出力する。
    // 画像と同じく、ビルド時にここで CDN URL に書き換える（処理パスを画像と揃える）。
    // 動画ファイルは git 管理外で R2 上にしかないので width/height 取得・srcset 生成はしない
    if (tagName === 'video') {
      const src = properties.src;
      if (typeof src !== 'string' || !src.startsWith('/videos/')) return;
      if (!baseUrl) return;
      return { src: `${baseUrl}${src}` };
    }
  };
}

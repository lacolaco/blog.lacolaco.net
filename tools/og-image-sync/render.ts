import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_DOMAIN_NAME } from '../../src/libs/og-image/constants.ts';
import { buildOgImageSvg, convertSvgToPngBuffer } from '../../src/libs/og-image/image.tsx';
import type { OgImageTarget } from './discover.ts';
import type { FontLoader } from './fonts.ts';

const AVATAR_PATH = 'src/libs/og-image/avatar.png';

const avatarCache = new Map<string, string>();

/**
 * アバターを data URL として読む。
 * SSRルートは Vite の `?inline` で埋め込んでいたが、CIのNodeでは解決できないため自前で読む。
 * 88KB の base64 化を記事数だけ繰り返さないよう rootDir ごとに一度だけ読む。
 */
export function loadAvatarDataUrl(rootDir: string = process.cwd()): string {
  const cached = avatarCache.get(rootDir);
  if (cached !== undefined) {
    return cached;
  }
  const dataUrl = `data:image/png;base64,${readFileSync(join(rootDir, AVATAR_PATH)).toString('base64')}`;
  avatarCache.set(rootDir, dataUrl);
  return dataUrl;
}

/**
 * 記事1件のOG画像を描画する。
 * fontLoader を渡さない場合は記事ごとにGoogle Fontsへ問い合わせるため、
 * 複数記事を描画するときは createBatchedFontLoader の結果を渡す。
 */
export async function renderOgImage(
  target: OgImageTarget,
  rootDir: string = process.cwd(),
  fontLoader?: FontLoader,
): Promise<Buffer> {
  const svg = await buildOgImageSvg({
    title: target.title,
    publishedDate: target.publishedDate,
    siteDomainName: SITE_DOMAIN_NAME,
    avatarDataUrl: loadAvatarDataUrl(rootDir),
    fontLoader,
  });
  return convertSvgToPngBuffer(svg);
}

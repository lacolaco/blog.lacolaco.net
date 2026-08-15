import { buildOgImageSvg, convertSvgToPngBuffer } from './image';

const siteDomainName = 'blog.lacolaco.net';

/**
 * アバターは呼び出し側から data URL で受け取る。
 * Vite の `?inline` で埋め込むと CI の Node から呼べなくなるため、読み込み方法を呼び出し側に委ねる。
 * 差し替えは public/icons/laco.png 更新後に以下を実行 (320px = 右下160px表示×2x。-shave 1x1 は
 * laco.png の最外周1px黒枠が縮小時にグレーのにじみ→円形縁の線になるのを防ぐ):
 *   magick public/icons/laco.png -shave 1x1 -resize 320x320 -background white -alpha remove -alpha off src/libs/og-image/avatar.png
 */
export async function generateOgImage(params: {
  title: string;
  publishedDate: Date;
  avatarDataUrl: string;
}): Promise<Buffer> {
  const svg = await buildOgImageSvg({
    title: params.title,
    publishedDate: params.publishedDate,
    siteDomainName,
    avatarDataUrl: params.avatarDataUrl,
  });
  return convertSvgToPngBuffer(svg);
}

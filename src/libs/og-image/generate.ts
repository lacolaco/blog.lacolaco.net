// アバターは build 時に base64 data URL として SSR バンドルへ埋め込む。差し替えは public/icons/laco.png 更新後に
// 以下を実行 (320px = 右下160px表示×2x。-shave 1x1 は laco.png の最外周1px黒枠が縮小時にグレーのにじみ→円形縁の線になるのを防ぐ):
//   magick public/icons/laco.png -shave 1x1 -resize 320x320 -background white -alpha remove -alpha off src/libs/og-image/avatar.png
import avatarDataUrl from './avatar.png?inline';
import { buildOgImageSvg, convertSvgToPngBuffer } from './image';

const siteDomainName = 'blog.lacolaco.net';

export async function generateOgImage(params: { title: string; publishedDate: Date }): Promise<Buffer> {
  const svg = await buildOgImageSvg({
    title: params.title,
    publishedDate: params.publishedDate,
    siteDomainName,
    avatarDataUrl,
  });
  return convertSvgToPngBuffer(svg);
}

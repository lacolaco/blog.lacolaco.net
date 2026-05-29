// アバター画像は build 時に base64 data URL として SSR バンドルに埋め込む。
//
// アバター画像を差し替えるときは public/icons/laco.png を更新したあとで以下を実行:
// (OG canvas は 2x 解像度なので、80px 表示に対し 2 倍の 160px で生成する)
//   magick public/icons/laco.png -resize 160x160 -background white -alpha remove -alpha off \
//     src/libs/og-image/avatar.png
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

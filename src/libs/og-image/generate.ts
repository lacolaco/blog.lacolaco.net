// アバター画像は build 時に base64 data URL として SSR バンドルに埋め込む。
//
// アバター画像を差し替えるときは public/icons/laco.png を更新したあとで以下を実行:
// (OG は 2x 解像度。アバターは 160px 表示なので 2 倍の 320px で生成する)
// -shave 1x1: laco.png は最外周 1px が黒枠なので、縮小時にグレーのにじみとなって
//             円形アバターの上下左右に線が出る。生成前に黒枠を除去する。
//   magick public/icons/laco.png -shave 1x1 -resize 320x320 -background white -alpha remove -alpha off \
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

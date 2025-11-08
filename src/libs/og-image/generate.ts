import { SITE_TITLE } from '../../consts';
import { buildOgImageSvg, convertSvgToPngBuffer } from './image';

const siteDomainName = 'blog.lacolaco.net';

export async function generateOgImage(params: { slug: string; title: string }): Promise<Buffer> {
  // Generate OG image SVG
  const svg = await buildOgImageSvg(params.title, SITE_TITLE, siteDomainName);
  // Convert the SVG to a PNG buffer
  const pngBuffer = convertSvgToPngBuffer(svg);
  return pngBuffer;
}

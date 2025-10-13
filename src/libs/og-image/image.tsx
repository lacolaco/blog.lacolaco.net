import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import { googleFontLoader } from './font-loader.js';

const fontFamily = 'Zen Kaku Gothic New';

/**
 * Build an OG image SVG from a given title.
 * @param title The title of the blog post.
 * @returns The SVG string.
 */
export async function buildOgImageSvg(
  title: string,
  siteTitle: string,
  siteDomainName: string,
  fontLoader: (text: string, font: string, weight: number) => Promise<ArrayBuffer> = googleFontLoader,
): Promise<string> {
  const fontNormal = await fontLoader(siteTitle + siteDomainName, fontFamily, 400);
  const fontBold = await fontLoader(siteTitle + title, fontFamily, 700);

  return await satori(
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        height: '100%',
        width: '100%',
        backgroundColor: '#fff',
        padding: '24px',
        fontFamily: `"${fontFamily}", sans-serif`,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          rowGap: '24px',
          height: '100%',
          width: '100%',
          border: '2px solid #1e1e1e',
          borderRadius: '8px',
          color: '#333',
          padding: '24px 24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            width: '100%',
            fontSize: '16px',
          }}
        >
          <span>{siteTitle}</span>
        </div>
        <div
          style={{
            flexGrow: '1',
            textOverflow: 'ellipsis',
            fontSize: '48px',
            fontWeight: 700,
            wordBreak: 'keep-all',
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            width: '100%',
            fontSize: '24px',
          }}
        >
          <span>{siteDomainName}</span>
        </div>
      </div>
    </div>,
    {
      width: 800,
      height: 400,
      fonts: [
        {
          name: fontFamily,
          data: fontNormal,
          weight: 400,
          style: 'normal',
        },
        {
          name: fontFamily,
          data: fontBold,
          weight: 700,
          style: 'normal',
        },
      ],
    },
  );
}

/**
 * Convert an SVG string to a PNG buffer.
 * @param svg The SVG string to convert.
 * @returns A promise that resolves with the PNG buffer.
 */
export async function convertSvgToPngBuffer(svg: string): Promise<Buffer> {
  const resvg = new Resvg(svg);
  const rendered = resvg.render();
  return rendered.asPng();
}

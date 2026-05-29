/**
 * Fetch a font from Google Fonts.
 *
 * @param text The text to render with the font. This is used to subset the font.
 * @param font The name of the font to fetch.
 * @param weight The weight of the font to fetch.
 * @returns A promise that resolves with the font data.
 */
export async function googleFontLoader(text: string, font: string, weight: number): Promise<ArrayBuffer> {
  // Google Fonts CSS2 API は family の区切りに `+` を期待する (生スペースは 400 を返し得る)
  const familyParam = font.replace(/ /g, '+');
  const API = `https://fonts.googleapis.com/css2?family=${familyParam}:wght@${weight}&text=${encodeURIComponent(text)}`;

  const cssRes = await fetch(API, {
    headers: {
      // Make sure it returns TTF.
      'User-Agent':
        'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
    },
  });
  if (!cssRes.ok) {
    throw new Error(`Failed to fetch font CSS: ${cssRes.status} ${cssRes.statusText} for ${font} ${weight}`);
  }
  const css = await cssRes.text();

  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

  if (!resource || !resource[1]) {
    throw new Error('Failed to fetch font');
  }

  const fontRes = await fetch(resource[1]);
  if (!fontRes.ok) {
    throw new Error(`Failed to fetch font file: ${fontRes.status} ${fontRes.statusText} for ${font} ${weight}`);
  }

  return fontRes.arrayBuffer();
}

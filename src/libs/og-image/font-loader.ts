/**
 * Fetch a font from Google Fonts.
 *
 * @param text The text to render with the font. This is used to subset the font.
 * @param font The name of the font to fetch.
 * @param weight The weight of the font to fetch.
 * @returns A promise that resolves with the font data.
 */
export async function googleFontLoader(text: string, font: string, weight: number): Promise<ArrayBuffer> {
  const API = `https://fonts.googleapis.com/css2?family=${font}:wght@${weight}&text=${encodeURIComponent(text)}`;

  const css = await (
    await fetch(API, {
      headers: {
        // Make sure it returns TTF.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_8; de-at) AppleWebKit/533.21.1 (KHTML, like Gecko) Version/5.0.5 Safari/533.21.1',
      },
    })
  ).text();

  const resource = css.match(/src: url\((.+)\) format\('(opentype|truetype)'\)/);

  if (!resource || !resource[1]) {
    throw new Error('Failed to fetch font');
  }

  const res = await fetch(resource[1]);

  return res.arrayBuffer();
}

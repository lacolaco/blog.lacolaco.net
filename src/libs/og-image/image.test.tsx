import { describe, it, expect, vi } from 'vitest';
import { buildOgImageSvg, convertSvgToPngBuffer } from './image.js';
import satori from 'satori';

vi.mock('satori');

describe('image', () => {
  describe('convertSvgToPngBuffer', () => {
    it('should convert a simple SVG to a PNG buffer', async () => {
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red" /></svg>';
      const pngBuffer = await convertSvgToPngBuffer(svg);
      expect(pngBuffer).toBeInstanceOf(Buffer);
      expect(pngBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('buildOgImageSvg', () => {
    it('should build an OG image SVG', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      const title = 'Test Title';
      const siteTitle = 'Test Site';
      const siteDomainName = 'test.com';
      const svg = await buildOgImageSvg(title, siteTitle, siteDomainName, mockFontLoader);

      expect(mockFontLoader).toHaveBeenCalled();
      expect(mockedSatori).toHaveBeenCalled();
      expect(svg).toBe('<svg></svg>');
    });
  });
});

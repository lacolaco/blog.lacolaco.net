import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateOgImage } from './generate';
import { buildOgImageSvg, convertSvgToPngBuffer } from './image';

vi.mock('./image', () => ({
  buildOgImageSvg: vi.fn(),
  convertSvgToPngBuffer: vi.fn(),
}));

const avatarDataUrl = 'data:image/png;base64,AAAA';

beforeEach(() => {
  vi.mocked(buildOgImageSvg).mockReset().mockResolvedValue('<svg />');
  vi.mocked(convertSvgToPngBuffer).mockReset().mockReturnValue(Buffer.from('png'));
});

describe('generateOgImage', () => {
  // Vite の `?inline` に依存すると CI の Node から呼べないため、avatar は引数で受け取る
  it('渡されたavatarDataUrlをそのままSVG生成に引き渡す', async () => {
    await generateOgImage({
      title: 'テスト記事',
      publishedDate: new Date('2026-08-15T00:00:00Z'),
      avatarDataUrl,
    });

    expect(vi.mocked(buildOgImageSvg).mock.calls[0]?.[0]).toMatchObject({ avatarDataUrl });
  });

  it('サイトのドメイン名を渡す', async () => {
    await generateOgImage({
      title: 'テスト記事',
      publishedDate: new Date('2026-08-15T00:00:00Z'),
      avatarDataUrl,
    });

    expect(vi.mocked(buildOgImageSvg).mock.calls[0]?.[0]).toMatchObject({ siteDomainName: 'blog.lacolaco.net' });
  });

  it('SVGをPNG Bufferに変換して返す', async () => {
    const result = await generateOgImage({
      title: 'テスト記事',
      publishedDate: new Date('2026-08-15T00:00:00Z'),
      avatarDataUrl,
    });

    expect(vi.mocked(convertSvgToPngBuffer)).toHaveBeenCalledWith('<svg />');
    expect(result).toEqual(Buffer.from('png'));
  });
});

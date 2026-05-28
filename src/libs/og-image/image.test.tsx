import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildOgImageSvg, convertSvgToPngBuffer, tierOf, splitPhrases, visualLen } from './image.js';
import satori from 'satori';

vi.mock('satori');
vi.mock('@resvg/resvg-js', () => ({
  Resvg: class {
    render() {
      return { asPng: () => Buffer.from('mock-png-data') };
    }
  },
}));

beforeEach(() => {
  vi.mocked(satori).mockReset();
});

describe('image', () => {
  describe('convertSvgToPngBuffer', () => {
    it('SVG を PNG Buffer に変換する', () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>';
      const pngBuffer = convertSvgToPngBuffer(svg);
      expect(pngBuffer).toBeInstanceOf(Buffer);
      expect(pngBuffer.length).toBeGreaterThan(0);
    });
  });

  describe('visualLen', () => {
    it('純英字 (半角 ASCII) は文字数の 0.5 倍', () => {
      expect(visualLen('abc')).toBe(1.5);
      expect(visualLen('20 Lines Simple Store with RxJS')).toBe(15.5);
    });

    it('CJK (全角) は 1 文字 1.0', () => {
      expect(visualLen('習慣や文化も適者生存')).toBe(10);
      expect(visualLen('ひらがな')).toBe(4);
    });

    it('混在は半角と全角を別々に重み付け', () => {
      // 'Angular v22' = 11 半角 = 5.5、'の' = 1 全角 = 1 → 6.5
      expect(visualLen('Angular v22の')).toBe(6.5);
    });

    it('全角スペース (U+3000) や制御文字は全角扱い (1.0)', () => {
      expect(visualLen('　')).toBe(1);
      expect(visualLen('\t')).toBe(1);
    });

    it('空文字列は 0', () => {
      expect(visualLen('')).toBe(0);
    });
  });

  describe('tierOf', () => {
    it('境界値で正しい tier を返す (短いタイトルほど大きいフォントサイズ tier)', () => {
      expect(tierOf(1)).toBe('xxl');
      expect(tierOf(20)).toBe('xxl');
      expect(tierOf(21)).toBe('xl');
      expect(tierOf(35)).toBe('xl');
      expect(tierOf(36)).toBe('l');
      expect(tierOf(60)).toBe('l');
      expect(tierOf(61)).toBe('m');
      expect(tierOf(90)).toBe('m');
      expect(tierOf(91)).toBe('s');
      expect(tierOf(300)).toBe('s');
    });
  });

  describe('splitPhrases', () => {
    it('日本語タイトルを文節単位に分割する', () => {
      const phrases = splitPhrases('TSKaigi 2026「いつテストを書くか？」発表資料');
      expect(phrases.length).toBeGreaterThan(1);
      expect(phrases.join('')).toBe('TSKaigi 2026「いつテストを書くか？」発表資料');
    });

    it('英文タイトルは分割されず1要素配列になる', () => {
      expect(splitPhrases('20 Lines Simple Store with RxJS')).toEqual(['20 Lines Simple Store with RxJS']);
    });

    it('空文字列は空配列を返す', () => {
      expect(splitPhrases('')).toEqual([]);
    });
  });

  describe('buildOgImageSvg', () => {
    const fakeAvatarDataUrl = 'data:image/png;base64,iVBORw0KGgo=';

    it('指定されたタイトル・日付・ドメイン・アバターを satori に渡す', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      const svg = await buildOgImageSvg({
        title: 'テスト記事',
        publishedDate: new Date('2026-05-24T00:00:00.000Z'),
        siteDomainName: 'blog.lacolaco.net',
        avatarDataUrl: fakeAvatarDataUrl,
        fontLoader: mockFontLoader,
      });

      expect(svg).toBe('<svg></svg>');
      expect(mockedSatori).toHaveBeenCalledTimes(1);
    });

    it('JSX 内に文節分割済みタイトル・日付・ドメインが含まれる', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      await buildOgImageSvg({
        title: 'TSKaigi 2026「いつテストを書くか？」発表資料',
        publishedDate: new Date('2026-05-24T00:00:00.000Z'),
        siteDomainName: 'blog.lacolaco.net',
        avatarDataUrl: fakeAvatarDataUrl,
        fontLoader: mockFontLoader,
      });

      const json = JSON.stringify(mockedSatori.mock.calls[0][0]);
      expect(json).toContain('TSKaigi 2026');
      expect(json).toContain('発表資料');
      expect(json).toContain('2026-05-24');
      expect(json).toContain('blog.lacolaco.net');
    });

    it('satori の canvas サイズは 1200x630', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      await buildOgImageSvg({
        title: 'a',
        publishedDate: new Date('2026-05-24T00:00:00.000Z'),
        siteDomainName: 'blog.lacolaco.net',
        avatarDataUrl: fakeAvatarDataUrl,
        fontLoader: mockFontLoader,
      });

      const options = mockedSatori.mock.calls[0][1];
      expect(options.width).toBe(1200);
      expect(options.height).toBe(630);
    });
  });
});

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

    it('英文タイトルでも分割結果を結合すると元のタイトルに戻る', () => {
      // BudouX が純英字をどこで分割するか (1 要素か複数か) はモデル依存であり API 契約ではない。
      // splitPhrases の契約は「文字を欠落・改変せずに分割する」ことなので、結合一致で検証する。
      const title = '20 Lines Simple Store with RxJS';
      const phrases = splitPhrases(title);
      expect(phrases.length).toBeGreaterThan(0);
      expect(phrases.join('')).toBe(title);
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
      // フォントロードは sans 400 (ドメイン) / sans 700 (タイトル) / mono 400 (日付) の 3 種を並列実行
      expect(mockFontLoader).toHaveBeenCalledTimes(3);
    });

    it('JSX 内に文節分割済みタイトル・日付・ドメイン・アバターが含まれる', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      const title = 'TSKaigi 2026「いつテストを書くか？」発表資料';
      await buildOgImageSvg({
        title,
        publishedDate: new Date('2026-05-24T00:00:00.000Z'),
        siteDomainName: 'blog.lacolaco.net',
        avatarDataUrl: fakeAvatarDataUrl,
        fontLoader: mockFontLoader,
      });

      const json = JSON.stringify(mockedSatori.mock.calls[0][0]);
      // タイトルは splitPhrases の各文節として JSX に含まれる。
      // ハードコードした文字列だと BudouX モデル更新で分割位置が変わり偽陰性になるため、
      // splitPhrases の実際の出力に追従して検証する。
      for (const phrase of splitPhrases(title)) {
        expect(json).toContain(phrase);
      }
      expect(json).toContain('2026-05-24');
      expect(json).toContain('blog.lacolaco.net');
      expect(json).toContain(fakeAvatarDataUrl);
    });

    it('satori の canvas サイズは 2x 解像度 (2400x1260)', async () => {
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
      // retina 対応のため 1x 設計 (1200×630) の 2 倍で生成する
      expect(options.width).toBe(2400);
      expect(options.height).toBe(1260);
    });

    it('長文 (tier s) タイトルは maxHeight + overflow:hidden のクリップ枠で行数を制限する', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      // visualLen >= 91 で tier s (fontSize 40 / maxLines 4)
      const longTitle = 'あ'.repeat(120);
      await buildOgImageSvg({
        title: longTitle,
        publishedDate: new Date('2026-05-24T00:00:00.000Z'),
        siteDomainName: 'blog.lacolaco.net',
        avatarDataUrl: fakeAvatarDataUrl,
        fontLoader: mockFontLoader,
      });

      // tier s: Math.ceil(40 × 1.3 × 4) = 208 → px() で 2x して 416px。
      // satori に渡す JSX に overflow:hidden のクリップ枠が含まれることを発生源で検証する
      // (satori 側の overflow:hidden 実装は実レンダリングで tier s クリップを確認済み)。
      const json = JSON.stringify(mockedSatori.mock.calls[0][0]);
      expect(json).toContain('"maxHeight":"416px"');
      expect(json).toContain('"overflow":"hidden"');
    });

    it('アバターは右下に絶対配置の円形 / 旧レイアウトの区切り線は存在しない', async () => {
      const mockFontLoader = vi.fn().mockResolvedValue(new ArrayBuffer(0));
      const mockedSatori = vi.mocked(satori).mockResolvedValue('<svg></svg>');

      await buildOgImageSvg({
        title: 'テスト記事',
        publishedDate: new Date('2026-05-24T00:00:00.000Z'),
        siteDomainName: 'blog.lacolaco.net',
        avatarDataUrl: fakeAvatarDataUrl,
        fontLoader: mockFontLoader,
      });

      const json = JSON.stringify(mockedSatori.mock.calls[0][0]);
      // アバターは右下 (right 80×SCALE=160px) に絶対配置、円形 (borderRadius 80×SCALE=160px)
      expect(json).toContain('"right":"160px"');
      expect(json).toContain('"borderRadius":"160px"');
      // 旧レイアウト (アバター横の縦区切り線 #d0d7de) は撤去済みで存在しない
      expect(json).not.toContain('#d0d7de');
    });
  });
});

import { FONT_FAMILY_MONO, FONT_FAMILY_SANS } from '../../src/libs/og-image/constants.ts';
import { googleFontLoader } from '../../src/libs/og-image/font-loader.ts';

/** 日付 (yyyy-MM-dd) の描画に必要な文字 */
const DATE_CHARS = '0123456789-';

/**
 * サブセット指定に使えるURLエンコード後の長さの上限。
 * 実測では全368記事で 626 文字 (エンコード後 5096) で 200 が返る。
 * 一般的なURL長の安全域である 8000 に対し、余裕を見て設定する。
 */
const MAX_SUBSET_LENGTH = 6000;

export type FontLoader = (text: string, font: string, weight: number) => Promise<ArrayBuffer>;

function fontKey(font: string, weight: number): string {
  return `${font}:${weight}`;
}

/**
 * フォントを一度だけ取得し、以降はローカルで解決するローダーを作る。
 *
 * Google Fonts CSS2 API はサブセットを `text` パラメータで決めるため、記事ごとに描画すると
 * 記事数×3回の問い合わせが発生する。全記事のタイトルをまとめて1回で取得する。
 * サブセットの構成は描画結果に影響しない。全368記事の和集合・単一タイトル・記事ごと取得の
 * 3通りで同一記事を描画し、PNGがバイト単位で一致することを実測で確認している。
 */
export async function createBatchedFontLoader(
  titles: string[],
  siteDomainName: string,
  fetchFont: FontLoader = googleFontLoader,
): Promise<FontLoader> {
  const titleText = [...new Set(titles.join(''))].join('');

  // サブセットは記事数に比例して伸びる。上限に達したときに Google Fonts が何を返すかは
  // 保証されないため、URLとして無理のない長さを超えたら黙って進まず落とす
  if (encodeURIComponent(titleText).length > MAX_SUBSET_LENGTH) {
    throw new Error(`フォントのサブセットが大きすぎる (${titleText.length}文字)。記事数の増加に対して分割取得が要る`);
  }

  const loaded = new Map<string, ArrayBuffer>();
  await Promise.all(
    [
      { font: FONT_FAMILY_SANS, weight: 400, text: siteDomainName },
      { font: FONT_FAMILY_SANS, weight: 700, text: titleText },
      { font: FONT_FAMILY_MONO, weight: 400, text: DATE_CHARS },
    ].map(async ({ font, weight, text }) => {
      loaded.set(fontKey(font, weight), await fetchFont(text, font, weight));
    }),
  );

  return (_text: string, font: string, weight: number): Promise<ArrayBuffer> => {
    const data = loaded.get(fontKey(font, weight));
    return data
      ? Promise.resolve(data)
      : Promise.reject(new Error(`フォント ${font} (weight: ${weight}) をバッチ取得していない`));
  };
}

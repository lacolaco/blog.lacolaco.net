import { TZDate } from '@date-fns/tz';
import { Resvg } from '@resvg/resvg-js';
// budoux はランタイムで loadDefaultJapaneseParser のみ使用する。
// budoux の transitive deps (google-artifactregistry-auth / linkedom / commander) は
// budoux 自身の CLI publish 用であり、Astro SSR の tree-shake で実行バンドルから除外される
// (dist/server に当該 deps の参照なしを確認済み)。日本語文節分割のための意図的な採用。
import { loadDefaultJapaneseParser } from 'budoux';
import { format } from 'date-fns';
import satori from 'satori';
import { googleFontLoader } from './font-loader.js';

const FONT_FAMILY = 'Zen Kaku Gothic New';
const FONT_FAMILY_MONO = 'Source Code Pro';

const phraseParser = loadDefaultJapaneseParser();

/**
 * タイトルのフォントサイズ tier。命名は **フォントサイズの大きさ** を表す:
 *   xxl = 最大 (短いタイトル用)、s = 最小 (長いタイトル用)
 */
export type Tier = 's' | 'm' | 'l' | 'xl' | 'xxl';

/**
 * タイトルの「視覚的幅」を返す。
 * 半角 ASCII (0x20–0x7E) を 0.5、それ以外 (CJK 等、全角) を 1.0 として重み付け。
 * 英字と日本語で同じ文字数でも幅が違うので、tier の入力にはこれを使う。
 */
export function visualLen(title: string): number {
  let n = 0;
  for (const ch of title) {
    const cp = ch.codePointAt(0) ?? 0;
    n += cp >= 0x20 && cp <= 0x7e ? 0.5 : 1;
  }
  return n;
}

/**
 * タイトルの視覚的幅から表示 tier を決める。
 * タイトルが短いほど大きなフォントサイズの tier (xxl) を返す。
 *   ~20: xxl / ~35: xl / ~60: l / ~90: m / 91+: s
 */
export function tierOf(len: number): Tier {
  if (len <= 20) return 'xxl';
  if (len <= 35) return 'xl';
  if (len <= 60) return 'l';
  if (len <= 90) return 'm';
  return 's';
}

const TIER_STYLES: Record<Tier, { fontSize: number; maxLines: number }> = {
  xxl: { fontSize: 60, maxLines: 2 },
  xl: { fontSize: 56, maxLines: 3 },
  l: { fontSize: 48, maxLines: 4 },
  m: { fontSize: 46, maxLines: 4 },
  s: { fontSize: 40, maxLines: 4 },
};

export function splitPhrases(title: string): string[] {
  if (!title) return [];
  return phraseParser.parse(title);
}

// OG 画像は SNS の retina / 2x 表示でも鮮明にするため 2 倍解像度 (2400×1260) で生成する。
// 設計値はすべて 1x 基準 (1200×630) で記述し、描画時に px() で SCALE を乗じる。
const SCALE = 2;
const px = (n: number): string => `${n * SCALE}px`;

export interface BuildOgImageParams {
  title: string;
  publishedDate: Date;
  siteDomainName: string;
  /** OG 画像左側に表示するアバターの data URL ("data:image/png;base64,...") */
  avatarDataUrl: string;
  fontLoader?: (text: string, font: string, weight: number) => Promise<ArrayBuffer>;
}

/**
 * OG 画像の SVG 文字列を生成する (2400×1260 = 1x 設計 1200×630 の 2 倍解像度)。
 *
 * レイアウト方針 (数値はすべて 1x 基準。描画時に px() で 2 倍化):
 *   - 純白背景、装飾なし、上下中央の単一スタック
 *   - 左から: アバター (80px円 / borderRadius で円形クロップ) | 1px縦線 (96px高) | タイトル
 *   - 右上に公開日 (yyyy-MM-dd, monospace)、右下にドメイン
 *   - タイトルは視覚的幅 (半角 0.5 / 全角 1.0) の tier で自動フォントサイズ + 最大行数
 *   - 日本語タイトルは BudouX で文節分割し、各文節を span として並べて自然な改行
 */
export async function buildOgImageSvg(params: BuildOgImageParams): Promise<string> {
  const { title, publishedDate, siteDomainName, avatarDataUrl, fontLoader = googleFontLoader } = params;

  const dateStr = format(new TZDate(publishedDate, 'Asia/Tokyo'), 'yyyy-MM-dd');
  const phrases = splitPhrases(title);
  const len = visualLen(title);
  const tier = tierOf(len);
  const { fontSize, maxLines } = TIER_STYLES[tier];

  // フォント subset を描画される文字種ごとに絞る:
  //   weight 400 (sans) = ドメイン / weight 700 (sans) = タイトル / mono 400 = 日付
  const [fontNormal, fontBold, fontMono] = await Promise.all([
    fontLoader(siteDomainName, FONT_FAMILY, 400),
    fontLoader(title, FONT_FAMILY, 700),
    fontLoader(dateStr, FONT_FAMILY_MONO, 400),
  ]);

  return await satori(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        position: 'relative',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        fontFamily: `"${FONT_FAMILY}", sans-serif`,
      }}
    >
      <div
        style={{
          width: '100%',
          paddingLeft: px(80),
          paddingRight: px(80),
          display: 'flex',
          alignItems: 'center',
          gap: px(32),
        }}
      >
        {/* アバター (80px円 / borderRadius で円形クロップ。
            "50%" だと satori が四隅の正方形を残すことがあるため絶対値 px(40) で指定)。
            width/height 属性は satori 推奨のサイズ指定方法、style はレイアウトボックス用。
            どちらも 80px(1x)×SCALE。最終ラスタ上のアバターは 80×SCALE=160 device px で
            描画されるため avatar.png も 160px で用意している (1x のままだと拡大されて荒くなる)。 */}
        <img
          src={avatarDataUrl}
          width={80 * SCALE}
          height={80 * SCALE}
          style={{
            width: px(80),
            height: px(80),
            borderRadius: px(40),
            flexShrink: 0,
          }}
        />

        {/* 区切り線 */}
        <div
          style={{
            width: px(1),
            height: px(96),
            backgroundColor: '#d0d7de',
            flexShrink: 0,
          }}
        />

        {/* タイトル */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: px(fontSize),
            fontWeight: 700,
            color: '#1f2937',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
            flex: 1,
            // maxLines を超える長文は maxHeight + overflow:hidden で行をクリップする。
            // satori は overflow:hidden をサポートし、最長 tier s (40×1.3×4) でも実レンダリングで
            // クリップされることを確認済み。fontSize × lineHeight(1.3) × maxLines は小数になり得るので、
            // 最終行が 1px 足りずに欠けないよう Math.ceil で切り上げて余裕を持たせる。
            maxHeight: px(Math.ceil(fontSize * 1.3 * maxLines)),
            overflow: 'hidden',
          }}
        >
          {phrases.map((p, i) => (
            <span key={i} style={{ wordBreak: 'keep-all' }}>
              {p}
            </span>
          ))}
        </div>
      </div>

      {/* 右上: 公開日 */}
      <div
        style={{
          position: 'absolute',
          top: px(56),
          right: px(100),
          fontSize: px(20),
          color: '#6b7280',
          fontFamily: `"${FONT_FAMILY_MONO}", monospace`,
          letterSpacing: '0.02em',
          display: 'flex',
        }}
      >
        {dateStr}
      </div>

      {/* 右下: ドメイン */}
      <div
        style={{
          position: 'absolute',
          bottom: px(56),
          right: px(100),
          fontSize: px(24),
          fontWeight: 400,
          color: '#6b7280',
          letterSpacing: '0.02em',
          display: 'flex',
        }}
      >
        {siteDomainName}
      </div>
    </div>,
    {
      width: 1200 * SCALE,
      height: 630 * SCALE,
      fonts: [
        { name: FONT_FAMILY, data: fontNormal, weight: 400, style: 'normal' },
        { name: FONT_FAMILY, data: fontBold, weight: 700, style: 'normal' },
        { name: FONT_FAMILY_MONO, data: fontMono, weight: 400, style: 'normal' },
      ],
    },
  );
}

export function convertSvgToPngBuffer(svg: string): Buffer {
  const resvg = new Resvg(svg);
  return resvg.render().asPng();
}

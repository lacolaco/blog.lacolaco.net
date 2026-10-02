/**
 * OG画像に描画するサイトのドメイン名。
 * SSRルート経由 (generate.ts) とCI生成 (tools/og-image-sync/render.ts) の両方が使う。
 * 二箇所に持つと、片方だけを変更したときに指紋と描画結果がずれる。
 */
export const SITE_DOMAIN_NAME = 'blog.lacolaco.net';

/**
 * OG画像の描画に使うフォント。
 * image.tsx (描画) と tools/og-image-sync/fonts.ts (一括取得) の双方が同じ名前を指す必要がある。
 * 片方だけ変えると、取得済みのフォントが見つからず生成時に失敗する。
 */
export const FONT_FAMILY_SANS = 'Zen Kaku Gothic New';
export const FONT_FAMILY_MONO = 'Source Code Pro';

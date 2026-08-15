/**
 * OG画像に描画するサイトのドメイン名。
 * SSRルート経由 (generate.ts) とCI生成 (tools/og-image-sync/render.ts) の両方が使う。
 * 二箇所に持つと、片方だけを変更したときに指紋と描画結果がずれる。
 */
export const SITE_DOMAIN_NAME = 'blog.lacolaco.net';

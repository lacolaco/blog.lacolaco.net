import type { SyntaxHighlightConfig, ShikiConfig } from '@astrojs/markdown-remark';
import { satteri } from '@astrojs/markdown-satteri';
import { satteriExtractMediaHtml } from '../rehype-extract-media-html/satteri.ts';
import { satteriImageCdn } from '../rehype-image-cdn/satteri.ts';
import { satteriEmbed } from '../remark-embed/satteri.ts';
import { satteriBreaks } from './plugins/breaks.ts';
import { satteriListSpread } from './plugins/list-spread.ts';
import { satteriGithubAlert } from './plugins/github-alert.ts';
import { satteriHighlight } from './plugins/highlight.ts';
import { satteriGithubEmoji } from './plugins/github-emoji.ts';
import { satteriKatex } from './plugins/katex.ts';
import { satteriMermaid } from './plugins/mermaid.ts';
import { satteriSmartypants } from './plugins/smartypants.ts';

interface MarkdownConfig {
  processor: ReturnType<typeof satteri>;
  syntaxHighlight: SyntaxHighlightConfig;
  shikiConfig: ShikiConfig;
}

const SHIKI_CONFIG: ShikiConfig = { theme: 'github-light' };

/**
 * 記事の Markdown を HTML にする設定。astro.config.ts の `markdown` と、その検査 (index.spec.ts) が共有する。
 *
 * Sätteri は生 HTML を解析し直さずそのまま出力する。unified の処理系は最後に rehype-raw を実行するため、
 * 生 HTML の文字参照 (`&#64;`) が文字に戻ってしまう。
 * https://docs.astro.build/en/guides/upgrade-to/v7/
 *
 * @param options.publicDir 画像の寸法を読む public ディレクトリ。検査で差し替える。省略時は `process.cwd()/public`
 */
export function createMarkdownConfig(options: { publicDir?: string } = {}): MarkdownConfig {
  return {
    processor: satteri({
      // smartPunctuation は Astro の unified と同じ remark-smartypants を satteriSmartypants で動かすため切る
      features: { gfm: true, math: true, smartPunctuation: false },
      // 順序は unified のときと同じ (smartypants、breaks、math、embed)。
      // satteriExtractMediaHtml は notion-sync が出力する <video src="/videos/..."> と
      // 記事本文が使う <img src="/images/..."> を含む生 HTML だけを展開し、CDN の URL に書き換える
      // 最小スコープのプラグイン。対象タグを含まない生 HTML には触れない
      mdastPlugins: [
        satteriSmartypants,
        satteriListSpread,
        satteriBreaks,
        satteriKatex,
        satteriMermaid,
        satteriEmbed(),
        satteriExtractMediaHtml({ publicDir: options.publicDir }),
      ],
      hastPlugins: [
        satteriHighlight(),
        satteriGithubEmoji,
        satteriGithubAlert,
        satteriImageCdn({ publicDir: options.publicDir }),
      ],
    }),
    // 色付けは satteriHighlight が行うため、Astro 標準の色付けは切る
    syntaxHighlight: false,
    shikiConfig: SHIKI_CONFIG,
  };
}

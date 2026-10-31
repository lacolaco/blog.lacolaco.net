import { unified, type MarkdownProcessor, type UnifiedResolvedOptions } from '@astrojs/markdown-remark';
import type { SyntaxHighlightConfig, ShikiConfig } from '@astrojs/markdown-remark';
import rehypeGithubAlert from 'rehype-github-alert';
import rehypeGithubEmoji from 'rehype-github-emoji';
import rehypeKatex from 'rehype-katex';
import rehypeMermaid from 'rehype-mermaid';
import remarkBreaks from 'remark-breaks';
import remarkMath from 'remark-math';
import rehypeEscapeAt from '../rehype-escape-at/index.ts';
import rehypeExtractMediaHtml from '../rehype-extract-media-html/index.ts';
import rehypeImageCdn from '../rehype-image-cdn/index.ts';
import remarkEmbed from '../remark-embed/index.ts';

interface MarkdownConfig {
  processor: MarkdownProcessor<UnifiedResolvedOptions>;
  syntaxHighlight: SyntaxHighlightConfig;
  shikiConfig: ShikiConfig;
}

/**
 * 記事の Markdown を HTML にする設定。astro.config.ts の `markdown` と、その検査 (index.spec.ts) が共有する。
 *
 * Astro v7 の既定の処理系は Sätteri に変わった。Sätteri は remark / rehype のプラグインを実行しないため、
 * 処理系を `unified()` に戻さないと、数式 (remarkMath / rehypeKatex)、Mermaid、GitHub 形式の注記、絵文字、
 * 埋め込み、画像と動画の CDN 書き換えが、エラーなしで外れる。
 * https://docs.astro.build/en/guides/upgrade-to/v7/
 *
 * @param options.publicDir 画像の寸法を読む public ディレクトリ。検査で差し替える。省略時は `process.cwd()/public`
 */
export function createMarkdownConfig(options: { publicDir?: string } = {}): MarkdownConfig {
  return {
    processor: unified({
      gfm: true,
      remarkPlugins: [remarkBreaks, remarkMath, remarkEmbed],
      // rehypeExtractMediaHtml は notion-sync が出力する <video src="/videos/..."> と
      // 記事本文が使う <img src="/images/..."> を含む raw ノードのみを element 化する
      // 最小スコープのプラグイン。後段の rehype-image-cdn が visit できるようにするため
      // 先頭に置く。対象タグを含まない raw HTML には触れない
      rehypePlugins: [
        rehypeExtractMediaHtml,
        rehypeGithubEmoji,
        rehypeGithubAlert,
        rehypeKatex,
        [rehypeMermaid, { strategy: 'pre-mermaid' }],
        [rehypeImageCdn, { publicDir: options.publicDir }],
        // 実処理は Astro が最後に実行する rehype-raw の後に回る (tools/rehype-escape-at 参照)
        rehypeEscapeAt,
      ],
    }),
    syntaxHighlight: {
      type: 'shiki',
      excludeLangs: ['mermaid', 'math'],
    },
    shikiConfig: {
      theme: 'github-light',
    },
  };
}

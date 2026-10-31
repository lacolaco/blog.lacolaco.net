import { strict as assert } from 'node:assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import type { MarkdownRenderer } from '@astrojs/markdown-remark';
import { createMarkdownConfig } from './index.ts';

// 有効な PNG (2x1)。image-size が幅と高さを読めればよい
// prettier-ignore
const MINIMAL_PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0xf4, 0x22, 0x7f,
  0x8a, 0x00, 0x00, 0x00, 0x0e, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9c, 0x63, 0x60, 0x60, 0x60, 0xf8,
  0x0f, 0xc2, 0x00, 0x06, 0x03, 0x01, 0xff, 0xcf,
  0x87, 0xc6, 0x70, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

const CDN_BASE_URL = 'https://images.example.test';

let publicDir: string;
let renderer: MarkdownRenderer;
let originalCdnBaseUrl: string | undefined;

// 記事の HTML はサイトの設定が組み立てた処理系を通して作られる。
// ここでは astro.config.ts が使うものと同じ設定を渡して Markdown を変換する
async function render(markdown: string): Promise<string> {
  const result = await renderer.render(markdown);
  return result.code;
}

before(async () => {
  publicDir = mkdtempSync(join(tmpdir(), 'markdown-pipeline-'));
  mkdirSync(join(publicDir, 'images', 'post'), { recursive: true });
  writeFileSync(join(publicDir, 'images', 'post', 'exists.png'), MINIMAL_PNG);

  originalCdnBaseUrl = process.env.IMAGE_CDN_BASE_URL;
  process.env.IMAGE_CDN_BASE_URL = CDN_BASE_URL;

  const config = createMarkdownConfig({ publicDir });
  renderer = await config.processor.createRenderer({
    syntaxHighlight: config.syntaxHighlight,
    shikiConfig: config.shikiConfig,
  });
});

after(() => {
  rmSync(publicDir, { recursive: true, force: true });
  if (originalCdnBaseUrl === undefined) delete process.env.IMAGE_CDN_BASE_URL;
  else process.env.IMAGE_CDN_BASE_URL = originalCdnBaseUrl;
});

describe('Markdown の処理系', () => {
  test('Sätteri である', () => {
    assert.equal(createMarkdownConfig().processor.name, 'satteri');
  });

  describe('raw HTML', () => {
    test('文字参照は文字に戻されずそのまま出力される', async () => {
      const html = await render('<div><span>&#64;lacolaco&#64;misskey.io</span></div>');
      assert.match(html, /<div><span>&#64;lacolaco&#64;misskey\.io<\/span><\/div>/);
    });
  });

  describe('unified の処理系との出力の一致', () => {
    test('引用符は remark-smartypants の向きになり、日本語の直前の開き引用符も閉じ引用符になる', async () => {
      const html = await render('日本語の"引用"です');
      assert.match(html, /日本語の”引用”です/);
    });

    test('ハイフン2つは em dash になる', async () => {
      const html = await render('flag --emit を使う');
      assert.match(html, /flag —emit を使う/);
    });

    test('コードの末尾の空行は空の行として残る', async () => {
      const html = await render('```ts\nconst a = 1;\n\n```');
      assert.match(html, /<span class="line"><\/span><\/code>/);
    });

    test('markdown のコードブロックの埋め込み言語は、後ろのブロックで読み込まれる言語の影響を受けない', async () => {
      const html = await render('````markdown\n---\ntitle: x\n---\n````\n\n```yaml\ntitle: x\n```');
      const [markdownBlock] = html.split('</pre>');
      assert.match(markdownBlock, /<span style="color:#005CC5;font-weight:bold">---<\/span>/);
    });

    test('空行を挟んだ入れ子のリストの緩い判定は remark-parse に合わせる', async () => {
      const html = await render('- d\n  1. x\n  1. y\n\n  - z\n- e\n');
      assert.match(html, /<ol>\n<li>\n<p>x<\/p>/);
      assert.match(html, /<li>d\n<ol>/);
      assert.match(html, /<li>z<\/li>/);
    });

    test('Mermaid の定義は末尾の改行を含む', async () => {
      const html = await render('```mermaid\ngraph TD; A-->B;\n```');
      assert.match(html, /<pre class="mermaid">graph TD; A--&gt;B;\n<\/pre>/);
    });
  });

  describe('数式', () => {
    test('インライン数式は KaTeX の inline 要素になる', async () => {
      const html = await render('式は $a^2 + b^2$ です。');
      assert.match(html, /<span class="katex">/);
      assert.doesNotMatch(html, /katex-display/);
    });

    // PostDetailPage が CDN から読む KaTeX の CSS は 0.16 系で、`katex-base` のような 0.17 以降のクラス名を知らない
    test('KaTeX の出力は PostDetailPage が読む CSS のクラス名 (0.16 系) を使う', async () => {
      const html = await render('式は $a^2$ です。');
      assert.match(html, /<span class="base">/);
      assert.doesNotMatch(html, /katex-base/);
    });

    test('ブロック数式は KaTeX の display 要素になる', async () => {
      const html = await render('$$\n\\frac{a}{b}\n$$');
      assert.match(html, /<span class="katex-display">/);
    });
  });

  describe('Mermaid', () => {
    test('mermaid のコードブロックは pre.mermaid になり、コードの色付けを受けない', async () => {
      const html = await render('```mermaid\ngraph TD; A-->B;\n```');
      assert.match(html, /<pre class="mermaid">/);
      assert.doesNotMatch(html, /astro-code/);
    });
  });

  describe('GitHub 形式の注記', () => {
    for (const kind of ['note', 'tip', 'important', 'warning', 'caution']) {
      test(`${kind.toUpperCase()} は markdown-alert-${kind} になる`, async () => {
        const html = await render(`> [!${kind.toUpperCase()}]\n> 本文`);
        assert.match(html, new RegExp(`<div class="markdown-alert markdown-alert-${kind}"`));
        assert.match(html, /class="markdown-alert-title"/);
      });
    }
  });

  describe('絵文字', () => {
    test('ショートコードは絵文字に置き換わる', async () => {
      const html = await render('完了 :tada:');
      assert.doesNotMatch(html, /:tada:/);
      assert.match(html, /🎉|emoji/);
    });
  });

  describe('改行', () => {
    test('段落内の改行は br になる', async () => {
      const html = await render('1行目\n2行目');
      assert.match(html, /1行目<br>\n2行目/);
    });
  });

  describe('raw HTML の img と video', () => {
    test('public/images にある画像は CDN の URL になり、寸法と srcset が付く', async () => {
      const html = await render('<img src="/images/post/exists.png" alt="例">');
      assert.match(html, new RegExp(`src="${CDN_BASE_URL}/post/exists.png"`));
      assert.match(html, /width="2"/);
      assert.match(html, /height="1"/);
      assert.match(html, /loading="lazy"/);
      assert.match(html, /decoding="async"/);
      assert.match(
        html,
        new RegExp(`srcset="${CDN_BASE_URL}/cdn-cgi/image/width=480,format=auto/post/exists.png 480w`),
      );
      assert.match(html, /sizes="/);
    });

    test('public/images に無い画像は CDN の URL になり、寸法は付かない', async () => {
      const html = await render('<img src="/images/post/missing.png" alt="例">');
      assert.match(html, new RegExp(`src="${CDN_BASE_URL}/post/missing.png"`));
      assert.doesNotMatch(html, / width="/);
      assert.doesNotMatch(html, / height="/);
    });

    test('video の相対パスは CDN の URL になる', async () => {
      const html = await render('<video src="/videos/post/demo.mp4" controls></video>');
      assert.match(html, new RegExp(`<video[^>]*src="${CDN_BASE_URL}/videos/post/demo.mp4"`));
    });

    test('Markdown 記法の画像も CDN の URL になる', async () => {
      const html = await render('![代替](/images/post/exists.png)');
      assert.match(html, new RegExp(`src="${CDN_BASE_URL}/post/exists.png"`));
    });
  });

  describe('埋め込み', () => {
    test('Twitter の投稿 URL は tweet の埋め込みになる', async () => {
      const html = await render('https://twitter.com/user/status/1234567890');
      assert.match(html, /<div class="block-link block-link-tweet">/);
    });

    test('YouTube の URL は youtube の埋め込みになる', async () => {
      const html = await render('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
      assert.match(html, /<div class="block-link block-link-youtube">/);
      assert.match(html, /https:\/\/www\.youtube\.com\/embed\/dQw4w9WgXcQ/);
    });

    test('embed=1 付きの StackBlitz の URL は stackblitz の埋め込みになる', async () => {
      const html = await render('https://stackblitz.com/edit/example?embed=1');
      assert.match(html, /<div class="block-link block-link-stackblitz">/);
    });

    test('Google スライドの URL は google-slides の埋め込みになる', async () => {
      const html = await render('https://docs.google.com/presentation/d/abc123/pub');
      assert.match(html, /<div class="block-link block-link-google-slides">/);
    });

    test('それ以外の URL は default の埋め込みになる', async () => {
      const html = await render('https://example.com/page');
      assert.match(html, /<div class="block-link block-link-default">/);
      assert.match(html, /\/embed\?url=https:\/\/example\.com\/page/);
    });

    test('リンクの文字列が URL と違うときは埋め込みにしない', async () => {
      const html = await render('[説明](https://example.com/page)');
      assert.doesNotMatch(html, /block-link/);
      assert.match(html, /<a href="https:\/\/example\.com\/page">説明<\/a>/);
    });
  });

  describe('コードブロック', () => {
    test('通常の言語は shiki の github-light で色付けされる', async () => {
      const html = await render('```ts\nconst a = 1;\n```');
      assert.match(html, /class="astro-code github-light"/);
    });
  });
});

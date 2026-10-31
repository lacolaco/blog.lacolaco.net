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
  test('remark / rehype のプラグインを実行できる unified である (Sätteri ではない)', () => {
    assert.equal(createMarkdownConfig().processor.name, 'unified');
  });

  describe('数式', () => {
    test('インライン数式は KaTeX の inline 要素になる', async () => {
      const html = await render('式は $a^2 + b^2$ です。');
      assert.match(html, /<span class="katex">/);
      assert.doesNotMatch(html, /katex-display/);
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

  // Cloudflare の Email Obfuscation が `user@host` を書き換えないよう、テキストの @ は文字参照で出力する
  describe('テキストの @', () => {
    test('段落のテキストの @ は文字参照になる', async () => {
      const html = await render('連絡先は user@example.com です');
      assert.match(html, /user&#x40;example\.com/);
      assert.doesNotMatch(html, />[^<]*@[^<]*</);
    });

    test('埋め込みの生 HTML のテキストの @ も文字参照になる', async () => {
      const html = await render('<div class="card"><span>@lacolaco@misskey.io</span></div>');
      assert.match(html, /<span>&#x40;lacolaco&#x40;misskey\.io<\/span>/);
    });

    test('コードブロックのテキストの @ も文字参照になる', async () => {
      const html = await render('```js\nconst email = "user@example.com";\n```');
      assert.match(html, /user&#x40;example\.com/);
      assert.doesNotMatch(html, />[^<]*@[^<]*</);
    });

    test('属性値の @ はそのまま残る', async () => {
      const html = await render('[profile](https://misskey.io/@lacolaco)');
      assert.match(html, /href="https:\/\/misskey\.io\/@lacolaco"/);
    });

    test('@ 以外の文字の出力は変わらない', async () => {
      const html = await render('a & b < c');
      assert.match(html, /<p>a &#x26; b &#x3C; c<\/p>/);
    });
  });

  describe('コードブロック', () => {
    test('通常の言語は shiki の github-light で色付けされる', async () => {
      const html = await render('```ts\nconst a = 1;\n```');
      assert.match(html, /class="astro-code github-light"/);
    });
  });
});

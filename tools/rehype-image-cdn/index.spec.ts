import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import rehypeParse from 'rehype-parse';
import rehypeStringify from 'rehype-stringify';
import { unified } from 'unified';
import rehypeImageCdn from './index.ts';

// テスト用 fixture ディ��クトリ
const fixturesDir = join(import.meta.dirname, 'fixtures');
const publicDir = fixturesDir;

// 有効な PNG（2x1, RGBA, IDAT 込み）
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

// ���小限の GIF（1x1）
// prettier-ignore
const MINIMAL_GIF = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // GIF89a
  0x01, 0x00, // width: 1
  0x01, 0x00, // height: 1
  0x00, 0x00, 0x00, // GCT flag, etc.
  0x3b, // trailer
]);

const CDN_BASE_URL = 'https://images.blog.lacolaco.net';

async function processHtml(html: string, options: Record<string, unknown> = {}) {
  const result = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeImageCdn, { publicDir, ...options })
    .use(rehypeStringify)
    .process(html);
  return String(result);
}

before(() => {
  mkdirSync(join(fixturesDir, 'images', 'test'), { recursive: true });
  writeFileSync(join(fixturesDir, 'images', 'test', 'photo.png'), MINIMAL_PNG);
  writeFileSync(join(fixturesDir, 'images', 'test', 'photo.jpg'), MINIMAL_PNG); // image-size は拡張子ではなくヘッダで判定
  writeFileSync(join(fixturesDir, 'images', 'test', 'photo.jpeg'), MINIMAL_PNG);
  writeFileSync(join(fixturesDir, 'images', 'test', 'animation.gif'), MINIMAL_GIF);
  writeFileSync(join(fixturesDir, 'images', 'test', 'テスト.png'), MINIMAL_PNG);
  writeFileSync(join(fixturesDir, 'images', 'test', 'photo.webp'), MINIMAL_PNG); // image-size はヘッダで判定
});

after(() => {
  rmSync(join(fixturesDir, 'images'), { recursive: true, force: true });
});

describe('rehypeImageCdn', () => {
  describe('CDN URL 変換（baseUrl 設定時）', () => {
    test('PNG 画像の src が CDN URL に書き換えられる', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes(`src="${CDN_BASE_URL}/test/photo.png"`));
    });

    test('srcset に4幅の Cloudflare Image Resizing URL が生成される', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes(`${CDN_BASE_URL}/cdn-cgi/image/width=480,format=auto/test/photo.png 480w`));
      assert.ok(output.includes(`${CDN_BASE_URL}/cdn-cgi/image/width=768,format=auto/test/photo.png 768w`));
      assert.ok(output.includes(`${CDN_BASE_URL}/cdn-cgi/image/width=1024,format=auto/test/photo.png 1024w`));
      assert.ok(output.includes(`${CDN_BASE_URL}/cdn-cgi/image/width=1536,format=auto/test/photo.png 1536w`));
    });

    test('sizes 属性が���与される', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('sizes="(min-width: 768px) 768px, calc(100vw - 32px)"'));
    });

    test('baseUrl の末尾スラッシュが正規化される', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">', {
        baseUrl: CDN_BASE_URL + '/',
      });
      assert.ok(output.includes(`src="${CDN_BASE_URL}/test/photo.png"`));
      assert.ok(!output.includes('//test/photo.png'));
    });
  });

  describe('レイアウトシフト防止', () => {
    test('width/height 属性が画像の実寸で付与される', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      // MINIMAL_PNG は 2x1
      assert.ok(output.includes('width="2"'));
      assert.ok(output.includes('height="1"'));
    });

    test('URL エンコードされたパスでも width/height が付与される', async () => {
      const output = await processHtml('<img src="/images/test/%E3%83%86%E3%82%B9%E3%83%88.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('width="2"'));
      assert.ok(output.includes('height="1"'));
    });

    test('画像ファイルが存在しない場合は width/height を付与しない', async () => {
      const output = await processHtml('<img src="/images/nonexistent/missing.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(!output.includes('width="'));
      assert.ok(!output.includes('height="'));
      assert.ok(output.includes(`src="${CDN_BASE_URL}/nonexistent/missing.png"`));
    });
  });

  describe('loading/decoding 属性', () => {
    test('loading="lazy" と decoding="async" が付与される', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('loading="lazy"'));
      assert.ok(output.includes('decoding="async"'));
    });

    test('既存の loading 属性は上書きしない', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test" loading="eager">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('loading="eager"'));
      assert.ok(!output.includes('loading="lazy"'));
    });

    test('既存の decoding 属性は上書きしない', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test" decoding="sync">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('decoding="sync"'));
      assert.ok(!output.includes('decoding="async"'));
    });
  });

  describe('除外対象', () => {
    test('GIF 画像には srcset/sizes を付与��ない', async () => {
      const output = await processHtml('<img src="/images/test/animation.gif" alt="gif">', {
        baseUrl: CDN_BASE_URL,
      });
      // src は CDN URL に書き換え
      assert.ok(output.includes(`src="${CDN_BASE_URL}/test/animation.gif"`));
      // srcset/sizes なし
      assert.ok(!output.includes('srcset'));
      assert.ok(!output.includes('sizes'));
      // loading/decoding はあり
      assert.ok(output.includes('loading="lazy"'));
      assert.ok(output.includes('decoding="async"'));
      // width/height はあり（GIF は 1x1）
      assert.ok(output.includes('width="1"'));
      assert.ok(output.includes('height="1"'));
    });

    test('外部 URL の画像は一切変換しない', async () => {
      const input = '<img src="https://example.com/photo.png" alt="external">';
      const output = await processHtml(input, { baseUrl: CDN_BASE_URL });
      assert.ok(output.includes('src="https://example.com/photo.png"'));
      assert.ok(!output.includes('srcset'));
      assert.ok(!output.includes('loading'));
    });
  });

  describe('���数画像', () => {
    test('1つの HTML 内の全画像が変換される', async () => {
      const input =
        '<p><img src="/images/test/photo.png" alt="a"></p><p><img src="/images/test/animation.gif" alt="b"></p>';
      const output = await processHtml(input, { baseUrl: CDN_BASE_URL });
      // PNG は srcset あり
      assert.ok(output.includes(`src="${CDN_BASE_URL}/test/photo.png"`));
      assert.ok(output.includes('srcset'));
      // GIF は srcset なし
      assert.ok(output.includes(`src="${CDN_BASE_URL}/test/animation.gif"`));
    });
  });

  describe('baseUrl 未設定時', () => {
    test('src は変更されない', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">');
      assert.ok(output.includes('src="/images/test/photo.png"'));
    });

    test('srcset/sizes は付与されない', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">');
      assert.ok(!output.includes('srcset'));
      assert.ok(!output.includes('sizes'));
    });

    test('width/height は付与される（CLS 防止）', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">');
      assert.ok(output.includes('width="2"'));
      assert.ok(output.includes('height="1"'));
    });

    test('loading/decoding は付与される', async () => {
      const output = await processHtml('<img src="/images/test/photo.png" alt="test">');
      assert.ok(output.includes('loading="lazy"'));
      assert.ok(output.includes('decoding="async"'));
    });
  });

  describe('JPG/JPEG/WebP 対応', () => {
    test('.jpg で srcset が生成される', async () => {
      const output = await processHtml('<img src="/images/test/photo.jpg" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('srcset'));
      assert.ok(output.includes('/cdn-cgi/image/width=480,format=auto/test/photo.jpg 480w'));
    });

    test('.jpeg で srcset が生成される', async () => {
      const output = await processHtml('<img src="/images/test/photo.jpeg" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('srcset'));
      assert.ok(output.includes('/cdn-cgi/image/width=480,format=auto/test/photo.jpeg 480w'));
    });

    test('.webp で srcset が生成される', async () => {
      const output = await processHtml('<img src="/images/test/photo.webp" alt="test">', {
        baseUrl: CDN_BASE_URL,
      });
      assert.ok(output.includes('srcset'));
      assert.ok(output.includes('/cdn-cgi/image/width=480,format=auto/test/photo.webp 480w'));
    });
  });
});

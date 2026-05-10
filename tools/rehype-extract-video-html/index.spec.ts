import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import rehypeImageCdn from '../rehype-image-cdn/index.ts';
import rehypeExtractVideoHtml from './index.ts';

async function processMarkdown(md: string) {
  const result = await unified()
    // allowDangerousHtml: true で markdown 内の生 HTML を hast の raw ノードとして残す
    // (astro と同じ前段挙動)
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeExtractVideoHtml)
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

async function processMarkdownWithImageCdn(md: string, baseUrl: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeExtractVideoHtml)
    .use(rehypeImageCdn, { baseUrl })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

describe('rehypeExtractVideoHtml', () => {
  test('<video> を含む raw HTML が element に展開される', async () => {
    const html = await processMarkdown('<video src="/videos/foo/bar.mp4" controls></video>\n');
    assert.ok(html.includes('<video src="/videos/foo/bar.mp4" controls></video>'));
  });

  test('<video> が含まれない raw HTML はそのまま raw として残される (副作用なし)', async () => {
    const html = await processMarkdown('<details><summary>title</summary>body</details>\n');
    assert.ok(html.includes('<details><summary>title</summary>body</details>'));
  });

  test('`<videos>` や `<videoplayer>` のような前方一致タグは raw のままにする', async () => {
    const videos = await processMarkdown('<videos>list</videos>\n');
    assert.ok(videos.includes('<videos>list</videos>'));
    const player = await processMarkdown('<videoplayer src="/videos/x/y.mp4">test</videoplayer>\n');
    assert.ok(player.includes('<videoplayer src="/videos/x/y.mp4">test</videoplayer>'));
  });

  test('説明テキスト中の `<video>` は誤検知しない (raw のまま)', async () => {
    const md = '<p>The <video> tag is described in the HTML spec.</p>\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<p>The <video> tag is described in the HTML spec.</p>'));
  });

  test('HTML コメント中の <video> 言及は誤検知しない (raw のまま)', async () => {
    const md = '<!-- <video src="/videos/foo/bar.mp4"> sample -->\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<!-- <video src="/videos/foo/bar.mp4"> sample -->'));
  });

  test('src が `/videos/` 以外を指す <video> は raw のまま (notion-sync 由来でないものに触らない)', async () => {
    const md = '<video src="https://other.example.com/v.mp4" controls></video>\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<video src="https://other.example.com/v.mp4" controls></video>'));
  });

  test('<figure><video><figcaption></figure> 全体が element に展開される', async () => {
    const md =
      '<figure>\n  <video src="/videos/x/y.mp4" controls></video>\n  <figcaption>cap</figcaption>\n</figure>\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<video'));
    assert.ok(html.includes('src="/videos/x/y.mp4"'));
    assert.ok(html.includes('<figcaption>cap</figcaption>'));
  });

  test('1 つの markdown に video raw と video を含まない raw が混在しても、video 以外は raw のまま', async () => {
    const md = '<details>note</details>\n\n<video src="/videos/a/b.mp4" controls></video>\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<details>note</details>'));
    assert.ok(html.includes('<video src="/videos/a/b.mp4" controls></video>'));
  });

  test('markdown 構文の段落や image (![]()) は影響を受けない', async () => {
    const md = 'plain paragraph\n\n![alt](/images/x/y.png)\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<p>plain paragraph</p>'));
    assert.ok(html.includes('<img src="/images/x/y.png" alt="alt">'));
  });

  test('大文字の <VIDEO> や <Video> も element 化される (case-insensitive)', async () => {
    const upper = await processMarkdown('<VIDEO src="/videos/u/up.mp4" controls></VIDEO>\n');
    assert.ok(upper.includes('<video src="/videos/u/up.mp4" controls></video>'));
    const mixed = await processMarkdown('<Video src="/videos/m/mx.mp4" controls></Video>\n');
    assert.ok(mixed.includes('<video src="/videos/m/mx.mp4" controls></video>'));
  });

  test('rehype-image-cdn と連結すると <video src="/videos/..."> が CDN URL に書き換わる (パイプライン統合)', async () => {
    const md = '<video src="/videos/foo/bar.mp4" controls playsinline preload="metadata"></video>\n';
    const html = await processMarkdownWithImageCdn(md, 'https://images.example.com');
    assert.ok(html.includes('src="https://images.example.com/videos/foo/bar.mp4"'));
  });
});

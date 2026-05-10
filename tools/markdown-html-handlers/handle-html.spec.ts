import { strict as assert } from 'node:assert';
import { describe, test } from 'node:test';
import rehypeStringify from 'rehype-stringify';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import rehypeImageCdn from '../rehype-image-cdn/index.ts';
import { handleHtml } from './handle-html.ts';

async function processMarkdown(md: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true, handlers: { html: handleHtml } })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

async function processWithImageCdn(md: string, baseUrl: string) {
  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true, handlers: { html: handleHtml } })
    .use(rehypeImageCdn, { baseUrl })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(md);
  return String(result);
}

describe('handleHtml', () => {
  test('<video> を含む html ノードは element として hast に乗る', async () => {
    const html = await processMarkdown('<video src="/videos/foo/bar.mp4" controls></video>\n');
    assert.ok(html.includes('<video src="/videos/foo/bar.mp4" controls></video>'));
  });

  test('<video> 以外の生 HTML は raw のまま (副作用なし)', async () => {
    const html = await processMarkdown('<details><summary>title</summary>body</details>\n');
    assert.ok(html.includes('<details><summary>title</summary>body</details>'));
  });

  test('`<videos>` や `<videoplayer>` のような前方一致タグは raw のままにする', async () => {
    const html = await processMarkdown('<videos>list</videos>\n');
    assert.ok(html.includes('<videos>list</videos>'));
  });

  test('<figure><video><figcaption></figure> 全体が element 化される', async () => {
    const md =
      '<figure>\n  <video src="/videos/x/y.mp4" controls></video>\n  <figcaption>cap</figcaption>\n</figure>\n';
    const html = await processMarkdown(md);
    assert.ok(html.includes('<video'));
    assert.ok(html.includes('src="/videos/x/y.mp4"'));
    assert.ok(html.includes('<figcaption>cap</figcaption>'));
  });

  test('video raw と video を含まない raw が混在しても、video 以外は raw のまま', async () => {
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

  test('rehype-image-cdn と連結すると <video src="/videos/..."> が CDN URL に書き換わる (パイプライン統合)', async () => {
    const md = '<video src="/videos/foo/bar.mp4" controls playsinline preload="metadata"></video>\n';
    const html = await processWithImageCdn(md, 'https://images.example.com');
    assert.ok(html.includes('src="https://images.example.com/videos/foo/bar.mp4"'));
  });
});

import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import { strict as assert } from 'assert';
import { test, describe } from 'node:test';
import remarkEmbed from './index.ts';

async function processMarkdown(markdown: string) {
  const file = await remark()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkEmbed)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);
  return String(file);
}

describe('remarkEmbed', () => {
  describe('ツイートURLの埋め込み', () => {
    test('twitter.comのツイートURLであるとき、ツイートが埋め込まれる', async () => {
      const markdown = 'https://twitter.com/user/status/1234567890';
      const expectedHtml = `
<div class="block-link block-link-tweet">
  <blockquote class="twitter-tweet">
    <a href="https://twitter.com/user/status/1234567890">https://twitter.com/user/status/1234567890</a>
  </blockquote>
</div>
      `.trim();
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });

    test('x.comのツイートURLであるとき、ツイートが埋め込まれる', async () => {
      const markdown = 'https://x.com/user/status/0987654321';
      const expectedHtml = `
<div class="block-link block-link-tweet">
  <blockquote class="twitter-tweet">
    <a href="https://x.com/user/status/0987654321">https://x.com/user/status/0987654321</a>
  </blockquote>
</div>
      `.trim();
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });
  });

  describe('YouTube URLの埋め込み', () => {
    test('YouTubeのURLであるとき、YouTube動画が埋め込まれる', async () => {
      const markdown = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const expectedHtml = `
<div class="block-link block-link-youtube">
  <iframe
    width="560"
    height="315"
    src="https://www.youtube.com/embed/dQw4w9WgXcQ"
    frameborder="0"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowfullscreen
  ></iframe>
</div>
      `.trim();
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });
  });

  describe('埋め込まれないケース', () => {
    test('ツイートURLではないとき、埋め込まれない', async () => {
      const markdown = 'https://example.com/some-page';
      const expectedHtml = '<p><a href="https://example.com/some-page">https://example.com/some-page</a></p>';
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });

    test('パラグラフにリンク以外のコンテンツが含まれるとき、埋め込まれない', async () => {
      const markdown = 'This is a link: https://twitter.com/user/status/1234567890';
      const expectedHtml =
        '<p>This is a link: <a href="https://twitter.com/user/status/1234567890">https://twitter.com/user/status/1234567890</a></p>';
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });

    test('パラグラフに複数のリンクが含まれるとき、埋め込まれない', async () => {
      const markdown = 'https://twitter.com/user/status/1234567890 and https://example.com';
      const expectedHtml =
        '<p><a href="https://twitter.com/user/status/1234567890">https://twitter.com/user/status/1234567890</a> and <a href="https://example.com">https://example.com</a></p>';
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });

    test('リンクがパラグラフ直下ではないとき、埋め込まれない', async () => {
      const markdown = `
- https://twitter.com/user/status/1234567890
      `;
      const expectedHtml = `
<ul>
<li><a href="https://twitter.com/user/status/1234567890">https://twitter.com/user/status/1234567890</a></li>
</ul>
      `.trim();
      const result = await processMarkdown(markdown);
      assert.equal(result, expectedHtml);
    });
  });
});

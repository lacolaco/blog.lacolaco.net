import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { rehype } from 'rehype';
import rehypeImageCdn from './index.ts';

describe('rehypeImageCdn', () => {
  const originalEnv = process.env.IMAGE_CDN_BASE_URL;

  beforeEach(() => {
    delete process.env.IMAGE_CDN_BASE_URL;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.IMAGE_CDN_BASE_URL = originalEnv;
    } else {
      delete process.env.IMAGE_CDN_BASE_URL;
    }
  });

  it('環境変数が設定されていない場合、画像URLを変換しない', async () => {
    const input = '<img src="/images/foo/bar.png" alt="alt">';
    const result = await rehype().use(rehypeImageCdn).process(input);
    assert.ok(result.toString().includes('src="/images/foo/bar.png"'));
  });

  it('環境変数が設定されている場合、/images/で始まるURLを変換する（/images/プレフィックスは除去）', async () => {
    process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com';
    const input = '<img src="/images/foo/bar.png" alt="alt">';
    const result = await rehype().use(rehypeImageCdn).process(input);
    assert.ok(result.toString().includes('src="https://images.example.com/foo/bar.png"'));
  });

  it('オプションでbaseUrlを指定できる', async () => {
    const input = '<img src="/images/foo/bar.png" alt="alt">';
    const result = await rehype().use(rehypeImageCdn, { baseUrl: 'https://cdn.example.com' }).process(input);
    assert.ok(result.toString().includes('src="https://cdn.example.com/foo/bar.png"'));
  });

  it('末尾のスラッシュは正規化される', async () => {
    const input = '<img src="/images/foo/bar.png" alt="alt">';
    const result = await rehype().use(rehypeImageCdn, { baseUrl: 'https://cdn.example.com/' }).process(input);
    assert.ok(result.toString().includes('src="https://cdn.example.com/foo/bar.png"'));
  });

  it('/images/以外で始まるURLは変換しない', async () => {
    process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com';
    const input = '<img src="https://external.com/image.png" alt="alt">';
    const result = await rehype().use(rehypeImageCdn).process(input);
    assert.ok(result.toString().includes('src="https://external.com/image.png"'));
  });

  it('複数の画像を正しく変換する', async () => {
    process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com';
    const input = `
<div>
  <img src="/images/a.png" alt="img1">
  <p>Some text</p>
  <img src="/images/b.png" alt="img2">
</div>
`;
    const result = await rehype().use(rehypeImageCdn).process(input);
    const output = result.toString();
    assert.ok(output.includes('src="https://images.example.com/a.png"'));
    assert.ok(output.includes('src="https://images.example.com/b.png"'));
  });
});

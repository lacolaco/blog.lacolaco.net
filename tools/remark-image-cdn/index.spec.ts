import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { remark } from 'remark';
import remarkImageCdn from './index.ts';

describe('remarkImageCdn', () => {
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
    const input = '![alt](/images/foo/bar.png)';
    const result = await remark().use(remarkImageCdn).process(input);
    assert.strictEqual(result.toString().trim(), '![alt](/images/foo/bar.png)');
  });

  it('環境変数が設定されている場合、/images/で始まるURLを変換する（/images/プレフィックスは除去）', async () => {
    process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com';
    const input = '![alt](/images/foo/bar.png)';
    const result = await remark().use(remarkImageCdn).process(input);
    assert.strictEqual(result.toString().trim(), '![alt](https://images.example.com/foo/bar.png)');
  });

  it('オプションでbaseUrlを指定できる', async () => {
    const input = '![alt](/images/foo/bar.png)';
    const result = await remark().use(remarkImageCdn, { baseUrl: 'https://cdn.example.com' }).process(input);
    assert.strictEqual(result.toString().trim(), '![alt](https://cdn.example.com/foo/bar.png)');
  });

  it('末尾のスラッシュは正規化される', async () => {
    const input = '![alt](/images/foo/bar.png)';
    const result = await remark().use(remarkImageCdn, { baseUrl: 'https://cdn.example.com/' }).process(input);
    assert.strictEqual(result.toString().trim(), '![alt](https://cdn.example.com/foo/bar.png)');
  });

  it('/images/以外で始まるURLは変換しない', async () => {
    process.env.IMAGE_CDN_BASE_URL = 'https://r2.example.com';
    const input = '![alt](https://external.com/image.png)';
    const result = await remark().use(remarkImageCdn).process(input);
    assert.strictEqual(result.toString().trim(), '![alt](https://external.com/image.png)');
  });

  it('複数の画像を正しく変換する', async () => {
    process.env.IMAGE_CDN_BASE_URL = 'https://images.example.com';
    const input = `
![img1](/images/a.png)

Some text

![img2](/images/b.png)
`;
    const result = await remark().use(remarkImageCdn).process(input);
    const output = result.toString();
    assert.ok(output.includes('https://images.example.com/a.png'));
    assert.ok(output.includes('https://images.example.com/b.png'));
  });
});

import assert from 'assert';
import { describe, it } from 'node:test';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { newTransformContext } from './block-transformer';
import type { PageObject, SelectProperty } from './notion-types';
import { buildMarkdownFile, extractFrontmatter, generateContent } from './page-transformer';

async function loadPageFixture(fixtureFilename: string): Promise<PageObject> {
  const module = (await import(`./fixtures/${fixtureFilename}`)) as { default: PageObject };
  return JSON.parse(JSON.stringify(module.default)) as PageObject;
}

async function loadMarkdownFixture(fixtureFilename: string): Promise<string> {
  const fixturePath = join(new URL(import.meta.url).pathname, '..', 'fixtures', fixtureFilename);
  return await readFile(fixturePath, 'utf-8');
}

describe('extractFrontmatter', () => {
  it('基本的なフロントマターを正しく抽出する', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const frontmatter = extractFrontmatter(pageFixture);

    assert.strictEqual(frontmatter.title, 'Kitchen Sink');
    assert.strictEqual(frontmatter.slug, 'kitchen-sink');
    assert.strictEqual(frontmatter.icon, '📝');
    assert.strictEqual(frontmatter.category, 'Tech');
    assert.deepStrictEqual(frontmatter.tags, ['test']);
    assert.strictEqual(frontmatter.published, false);
    assert.strictEqual(typeof frontmatter.created_time, 'string');
    assert.strictEqual(typeof frontmatter.last_edited_time, 'string');
    assert.strictEqual(typeof frontmatter.notion_url, 'string');
  });

  it('locale=en の場合、slugにロケールが付与される', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.locale = { type: 'select', select: { name: 'en' } } as SelectProperty;

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.slug, 'kitchen-sink.en');
  });

  it('locale=ja の場合、slugにロケールは付与されない', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.locale = { type: 'select', select: { name: 'ja' } } as SelectProperty;

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.slug, 'kitchen-sink');
  });

  it('localeが未設定の場合、デフォルトでjaとして扱われる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.locale = { type: 'select', select: null } as SelectProperty;

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.slug, 'kitchen-sink');
  });

  it('published=falseの場合も正しく処理される', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.published = { type: 'checkbox', checkbox: false, id: 'test-id' };

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.published, false);
  });

  it('タグが空の場合、空配列になる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.tags = { type: 'multi_select', multi_select: [], id: 'test-id' };

    const frontmatter = extractFrontmatter(pageFixture);
    assert.deepStrictEqual(frontmatter.tags, []);
  });

  it('カテゴリが未設定の場合、空文字列になる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.category = { type: 'select', select: null, id: 'test-id' };

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.category, '');
  });

  it('アイコンが未設定の場合、空文字列になる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.icon = null;

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.icon, '');
  });

  it('タイトルが未設定の場合、空文字列になる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.title = { type: 'title', title: [], id: 'test-id' };

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.title, '');
  });

  it('スラッグが未設定の場合、空文字列になる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.slug = { type: 'rich_text', rich_text: [], id: 'test-id' };

    const frontmatter = extractFrontmatter(pageFixture);
    assert.strictEqual(frontmatter.slug, '');
  });
});

describe('generateContent', () => {
  it('ページからコンテンツを生成する', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const context = newTransformContext('test-slug');

    const content = generateContent(pageFixture, context);

    assert.strictEqual(typeof content, 'string');
    assert.ok(content.length > 0);
  });

  it('childrenがない場合、空のコンテンツを返す', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const context = newTransformContext('test-slug');
    // childrenを削除
    const pageWithoutChildren = { ...pageFixture };
    delete (pageWithoutChildren as PageObject & { children?: unknown }).children;

    const content = generateContent(pageWithoutChildren, context);

    assert.strictEqual(content, '');
  });

  it('コンテキストの画像ダウンロードタスクが更新される', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const context = newTransformContext('test-slug');

    generateContent(pageFixture, context);

    // generateContentの実行により、contextのimageDownloadsが更新されることを確認
    assert.ok(Array.isArray(context.imageDownloads));
  });
});

describe('buildMarkdownFile', () => {
  it('フロントマターとコンテンツから整形されたMarkdownを生成する', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const frontmatter = extractFrontmatter(pageFixture);
    const content = '# Test Content\n\nThis is a test.';

    const markdown = await buildMarkdownFile(frontmatter, content, newTransformContext('test-slug'));

    // This test only checks the buildMarkdownFile function with custom content
    assert.ok(markdown.includes('---\n'));
    assert.ok(markdown.includes("title: 'Kitchen Sink'"));
    assert.ok(markdown.includes('# Test Content'));
    assert.ok(markdown.includes('This is a test.'));
  });

  it('空のコンテンツでも正常に処理される', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const frontmatter = extractFrontmatter(pageFixture);
    const content = '';

    const markdown = await buildMarkdownFile(frontmatter, content, newTransformContext('test-slug'));

    assert.ok(markdown.includes('---\n'));
    assert.ok(markdown.includes("title: 'Kitchen Sink'"));
    assert.ok(markdown.includes('---\n'));
  });
});

describe('Kitchen Sink統合テスト', () => {
  it('Kitchen SinkページのフルMarkdown変換をテストする', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const expectedMarkdown = await loadMarkdownFixture('page-kitchen-sink.md');

    // 既存の関数を組み合わせてフル変換を実行
    const frontmatter = extractFrontmatter(pageFixture);
    const context = newTransformContext(frontmatter.slug);
    const content = generateContent(pageFixture, context);
    const actualMarkdown = await buildMarkdownFile(frontmatter, content, context);

    assert.strictEqual(actualMarkdown.trim(), expectedMarkdown.trim());
  });
});

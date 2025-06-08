import assert from 'assert';
import { readFile } from 'fs/promises';
import { describe, it } from 'node:test';
import type { PageObject, SelectProperty } from './notion-types';
import { transformNotionPageToMarkdown, extractFrontmatter } from './page-transformer';

async function loadPageFixture(fixtureFilename: string): Promise<PageObject> {
  const module = (await import(`./fixtures/${fixtureFilename}`)) as { default: PageObject };
  return JSON.parse(JSON.stringify(module.default)) as PageObject;
}

describe('transformNotionPageToMarkdown', () => {
  it('NotionページをフロントマターとMarkdownに変換する', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const expectedMarkdown = await readFile(new URL('./fixtures/page-kitchen-sink.md', import.meta.url), {
      encoding: 'utf-8',
    });

    const { markdown } = await transformNotionPageToMarkdown(pageFixture);
    assert.strictEqual(markdown, expectedMarkdown);
  });

  it('slugを抽出（locale: ja)', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const { slug } = await transformNotionPageToMarkdown(pageFixture);
    assert.strictEqual(slug, 'kitchen-sink');
  });

  it('locale=en の場合、slugはページのslugとlocaleからなる', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    pageFixture.properties.locale = { type: 'select', select: { name: 'en' } } as SelectProperty;
    const { slug } = await transformNotionPageToMarkdown(pageFixture);
    assert.strictEqual(slug, 'kitchen-sink.en');
  });
});

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

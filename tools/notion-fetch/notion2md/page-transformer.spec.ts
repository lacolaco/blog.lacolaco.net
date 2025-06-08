import assert from 'assert';
import { readFile } from 'fs/promises';
import { describe, it } from 'node:test';
import type { PageObject, SelectProperty } from '../notion-types';
import { transformNotionPageToMarkdown } from './page-transformer';

async function loadPageFixture(fixtureFilename: string): Promise<PageObject> {
  return await import(`../fixtures/${fixtureFilename}`).then((module: { default: PageObject }) => module.default);
}

describe('transformNotionPageToMarkdown', () => {
  it('NotionページをフロントマターとMarkdownに変換する', async () => {
    const pageFixture = await loadPageFixture('page-kitchen-sink.json');
    const expectedMarkdown = await readFile(new URL('../fixtures/page-kitchen-sink.md', import.meta.url), {
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

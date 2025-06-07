import assert from 'assert';
import { readFile } from 'fs/promises';
import { describe, it } from 'node:test';
import type { PageObject } from '../notion-types';
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

    const result = transformNotionPageToMarkdown(pageFixture);
    assert.strictEqual(result, expectedMarkdown);
  });
});

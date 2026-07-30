import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { classifyProvenance, jaSourceOf, notionUrlOf } from './provenance.ts';

const NOTION_URL = 'https://www.notion.so/foo-0130436c887b4cf5ac53b2bb027855a6';

describe('classifyProvenance', () => {
  test('auto_translated_from があれば auto-translate 生成物', () => {
    const p = classifyProvenance({
      frontmatter: { notion_url: NOTION_URL, auto_translated_from: 'a'.repeat(64) },
      inManifest: false,
    });
    assert.equal(p, 'auto-translated');
  });

  test('manifest に載っていれば notion-sync 由来', () => {
    const p = classifyProvenance({ frontmatter: { notion_url: NOTION_URL }, inManifest: true });
    assert.equal(p, 'notion-sync');
  });

  test('どちらでもなければ直接管理', () => {
    const p = classifyProvenance({ frontmatter: { locale: 'en' }, inManifest: false });
    assert.equal(p, 'direct');
  });

  test('auto_translated_from は manifest より優先する (ja の frontmatter を複製するため両立しうる)', () => {
    const p = classifyProvenance({
      frontmatter: { auto_translated_from: 'a'.repeat(64) },
      inManifest: true,
    });
    assert.equal(p, 'auto-translated');
  });
});

describe('notionUrlOf', () => {
  test('文字列があれば返す', () => {
    assert.equal(notionUrlOf({ notion_url: NOTION_URL }), NOTION_URL);
  });

  test('無い / 空 / 非文字列は undefined', () => {
    assert.equal(notionUrlOf({}), undefined);
    assert.equal(notionUrlOf({ notion_url: '' }), undefined);
    assert.equal(notionUrlOf({ notion_url: 42 }), undefined);
  });
});

describe('jaSourceOf', () => {
  test('.en.md を .md に戻す', () => {
    assert.equal(jaSourceOf('content/notion/posts/foo.en.md'), 'content/notion/posts/foo.md');
  });

  test('.en.md でないパスは変えない', () => {
    assert.equal(jaSourceOf('content/notion/posts/foo.md'), 'content/notion/posts/foo.md');
  });
});

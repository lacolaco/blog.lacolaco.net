import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { buildEnFrontmatter, isAutoTranslated, getAutoTranslatedFrom } from './frontmatter.ts';

const SAMPLE_JA_FRONTMATTER = {
  title: 'Angular: Motionを使ったアニメーション',
  slug: 'angular-animations-with-motion',
  icon: '',
  created_time: '2025-12-12T01:13:00.000Z',
  last_edited_time: '2026-03-28T16:15:00.000Z',
  tags: ['Motion'],
  published: true,
  locale: 'ja',
  category: 'Tech',
  canonical_url: 'https://zenn.dev/lacolaco/articles/angular-animations-with-motion',
  channels: ['Code', 'Angular'],
  notion_url: 'https://www.notion.so/Angular-xxxxx',
  features: { katex: false, mermaid: false, tweet: false },
  auto_translate: true,
};

describe('buildEnFrontmatter', () => {
  test('locale が en に上書きされる', () => {
    const en = buildEnFrontmatter({
      jaFrontmatter: SAMPLE_JA_FRONTMATTER,
      translatedTitle: 'Angular: Animations with Motion',
      bodyHash: 'a'.repeat(64),
    });
    assert.equal(en.locale, 'en');
  });

  test('title が翻訳結果に置換される', () => {
    const en = buildEnFrontmatter({
      jaFrontmatter: SAMPLE_JA_FRONTMATTER,
      translatedTitle: 'Angular: Animations with Motion',
      bodyHash: 'a'.repeat(64),
    });
    assert.equal(en.title, 'Angular: Animations with Motion');
  });

  test('auto_translated_from が付与される（hex 64 文字）', () => {
    const hash = 'b'.repeat(64);
    const en = buildEnFrontmatter({
      jaFrontmatter: SAMPLE_JA_FRONTMATTER,
      translatedTitle: 'X',
      bodyHash: hash,
    });
    assert.equal(en.auto_translated_from, hash);
  });

  test('auto_translate フィールドは en には含めない', () => {
    const en = buildEnFrontmatter({
      jaFrontmatter: SAMPLE_JA_FRONTMATTER,
      translatedTitle: 'X',
      bodyHash: 'a'.repeat(64),
    });
    assert.equal('auto_translate' in en, false);
  });

  test('コピーフィールドが ja からそのまま引き継がれる', () => {
    const en = buildEnFrontmatter({
      jaFrontmatter: SAMPLE_JA_FRONTMATTER,
      translatedTitle: 'X',
      bodyHash: 'a'.repeat(64),
    });
    assert.equal(en.slug, 'angular-animations-with-motion');
    assert.equal(en.icon, '');
    assert.equal(en.created_time, '2025-12-12T01:13:00.000Z');
    assert.equal(en.last_edited_time, '2026-03-28T16:15:00.000Z');
    assert.deepEqual(en.tags, ['Motion']);
    assert.equal(en.published, true);
    assert.equal(en.category, 'Tech');
    assert.equal(en.canonical_url, 'https://zenn.dev/lacolaco/articles/angular-animations-with-motion');
    assert.deepEqual(en.channels, ['Code', 'Angular']);
    assert.equal(en.notion_url, 'https://www.notion.so/Angular-xxxxx');
    assert.deepEqual(en.features, { katex: false, mermaid: false, tweet: false });
  });

  test('未知の passthrough フィールドも引き継がれる', () => {
    const en = buildEnFrontmatter({
      jaFrontmatter: { ...SAMPLE_JA_FRONTMATTER, custom_field: 'foo' },
      translatedTitle: 'X',
      bodyHash: 'a'.repeat(64),
    });
    assert.equal(en.custom_field, 'foo');
  });

  test('ja の locale が ja でなくても en に上書きされる', () => {
    const en = buildEnFrontmatter({
      jaFrontmatter: { ...SAMPLE_JA_FRONTMATTER, locale: undefined },
      translatedTitle: 'X',
      bodyHash: 'a'.repeat(64),
    });
    assert.equal(en.locale, 'en');
  });
});

describe('isAutoTranslated', () => {
  test('auto_translated_from があれば true', () => {
    assert.equal(isAutoTranslated({ auto_translated_from: 'abc' }), true);
  });

  test('auto_translated_from が無ければ false（手動 en）', () => {
    assert.equal(isAutoTranslated({ title: 'x' }), false);
  });

  test('auto_translated_from が空文字なら false', () => {
    assert.equal(isAutoTranslated({ auto_translated_from: '' }), false);
  });

  test('auto_translated_from が文字列以外なら false', () => {
    assert.equal(isAutoTranslated({ auto_translated_from: 123 }), false);
  });
});

describe('getAutoTranslatedFrom', () => {
  test('値があれば返す', () => {
    assert.equal(getAutoTranslatedFrom({ auto_translated_from: 'abc' }), 'abc');
  });

  test('無ければ undefined', () => {
    assert.equal(getAutoTranslatedFrom({}), undefined);
  });
});

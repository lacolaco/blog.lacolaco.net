import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { countStructure, validateStructure } from './structure-validator.ts';

describe('countStructure', () => {
  test('コードブロックを数える', () => {
    const markdown = `text

\`\`\`ts
const a = 1;
\`\`\`

text

\`\`\`
plain
\`\`\`
`;
    const counts = countStructure(markdown);
    assert.equal(counts.codeBlocks, 2);
  });

  test('画像を数える', () => {
    const markdown = `![a](/a.png)

text ![b](/b.png) text

![c](/c.png)
`;
    const counts = countStructure(markdown);
    assert.equal(counts.images, 3);
  });

  test('リンクを数える（画像を除く）', () => {
    const markdown = `[a](https://a) ![img](/i.png) [b](https://b)

text [c](https://c) text
`;
    const counts = countStructure(markdown);
    assert.equal(counts.links, 3);
    assert.equal(counts.images, 1);
  });

  test('bare URL paragraph を数える（単独行のリンク）', () => {
    const markdown = `text

https://example.com

other text

https://another.com
`;
    const counts = countStructure(markdown);
    assert.equal(counts.bareUrlParagraphs, 2);
  });

  test('bare URL とインラインリンクを区別する', () => {
    const markdown = `https://bare.com

text [labeled](https://labeled.com) inline

text https://inline-bare.com inline text
`;
    const counts = countStructure(markdown);
    // bare URL paragraph は単独行のもののみ
    assert.equal(counts.bareUrlParagraphs, 1);
    // インラインリンクとインライン bare は links カウントには含まれる（remark-gfm autolink）
    // が、bare URL paragraph には含まれない
  });

  test('明示的なテキストを持つリンクは bare URL paragraph ではない', () => {
    const markdown = `[Click here](https://example.com)
`;
    const counts = countStructure(markdown);
    assert.equal(counts.bareUrlParagraphs, 0);
  });

  test('リスト内の bare URL paragraph はカウントしない（remark-embed の変換対象外）', () => {
    const markdown = `- リストアイテム

  https://example.com
`;
    const counts = countStructure(markdown);
    // リスト内の paragraph は parent.type !== 'root' のため bareUrlParagraphs に含めない
    assert.equal(counts.bareUrlParagraphs, 0);
  });

  test('blockquote 内の bare URL paragraph はカウントしない', () => {
    const markdown = `> https://example.com
`;
    const counts = countStructure(markdown);
    assert.equal(counts.bareUrlParagraphs, 0);
  });
});

describe('validateStructure', () => {
  test('コードブロック数が一致 → ok', () => {
    const source = '```ts\na\n```\n\n```ts\nb\n```\n';
    const target = '```ts\na\n```\n\n```ts\nb\n```\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, true);
    assert.equal(result.mismatches.length, 0);
  });

  test('コードブロック数が不一致 → ng + reason', () => {
    const source = '```ts\na\n```\n\n```ts\nb\n```\n\n```ts\nc\n```\n';
    const target = '```ts\na\n```\n\n```ts\nb\n```\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.equal(result.mismatches.length, 1);
    assert.equal(result.mismatches[0].kind, 'codeBlocks');
    assert.equal(result.mismatches[0].source, 3);
    assert.equal(result.mismatches[0].target, 2);
  });

  test('画像数が一致 → ok', () => {
    const source = '![a](/a.png)\n\n![b](/b.png)\n';
    const target = '![a](/a.png)\n\n![b](/b.png)\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, true);
  });

  test('画像数が不一致 → ng', () => {
    const source = '![a](/a.png)\n\n![b](/b.png)\n';
    const target = '![a](/a.png)\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'images'));
  });

  test('リンク数が一致 → ok', () => {
    const source = '[a](https://a) [b](https://b)\n';
    const target = '[a](https://a) [b](https://b)\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, true);
  });

  test('bare URL paragraph の数が一致 → ok', () => {
    const source = 'text\n\nhttps://a.com\n\nhttps://b.com\n';
    const target = 'text-en\n\nhttps://a.com\n\nhttps://b.com\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, true);
  });

  test('bare URL が翻訳で文に巻き込まれた → ng', () => {
    const source = 'text\n\nhttps://a.com\n';
    // 翻訳結果で URL が prose の中に巻き込まれた（bare URL paragraph として認識されない）
    const target = 'text\n\nSee this link: https://a.com for more.\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'bareUrlParagraphs'));
  });

  test('複数の項目が同時に不一致 → 全て報告される', () => {
    const source = '```\na\n```\n\nhttps://a.com\n\n![img](/i.png)\n';
    const target = 'lost everything\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.length >= 3);
  });

  test('コードブロック内容が source と一致 → ok', () => {
    const source = '```ts\nconst a = 1;\n```\n';
    const target = '```ts\nconst a = 1;\n```\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, true);
  });

  test('コードブロック内容が翻訳されている → ng (codeBlockContent)', () => {
    const source = '```ts\n// 元のコメント\nconst a = 1;\n```\n';
    const target = '```ts\n// translated comment\nconst a = 1;\n```\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'codeBlockContent'));
  });

  test('コードブロック内の引用符が変換されている → ng (codeBlockContent)', () => {
    const source = '```html\n<img src="x" />\n```\n';
    // target の右引用符は Unicode RIGHT DOUBLE QUOTATION MARK (U+201D)。視覚的には ASCII " と区別困難なため
    // 編集時に誤って ASCII " に置き換えると検証ロジックを通り抜けるテストになる
    const target = '```html\n<img src="x” />\n```\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'codeBlockContent'));
  });

  test('インラインコードが byte 一致 → ok', () => {
    const source = 'use `decoding="async"` for X.\n';
    const target = 'X uses `decoding="async"` here.\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, true);
  });

  test('インラインコードの引用符が変換されている → ng (inlineCodeContent)', () => {
    const source = 'use `decoding="async"` for X.\n';
    // target の右引用符は Unicode RIGHT DOUBLE QUOTATION MARK (U+201D)。詳細は前テスト参照
    const target = 'X uses `decoding="async”` here.\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'inlineCodeContent'));
  });

  test('翻訳結果に source にないインラインコードが追加されている → ng (inlineCodes count)', () => {
    const source = 'plain text\n';
    const target = 'translated `extra` text\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'inlineCodes'));
  });

  test('翻訳結果のインラインコードが少ない → ng (inlineCodes count)', () => {
    const source = 'use `foo` and `bar`\n';
    const target = 'use foo and `bar`\n';
    const result = validateStructure(source, target);
    assert.equal(result.ok, false);
    assert.ok(result.mismatches.some((m) => m.kind === 'inlineCodes'));
  });
});

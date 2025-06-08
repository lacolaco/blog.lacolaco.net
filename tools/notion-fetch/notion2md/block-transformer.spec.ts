import assert from 'node:assert';
import { describe, it } from 'node:test';
import { transformNotionBlocksToMarkdown, type TransformContext } from './block-transformer';
import type { ParagraphBlockObject, RichTextItemObject, UntypedBlockObject } from '../notion-types';

async function loadFixture(fixtureFilename: string): Promise<UntypedBlockObject> {
  return await import(`../fixtures/${fixtureFilename}`).then(
    (module: { default: UntypedBlockObject }) => module.default,
  );
}

async function loadRichTextFixture(fixtureFilename: string): Promise<RichTextItemObject> {
  return await import(`../fixtures/${fixtureFilename}`).then(
    (module: { default: RichTextItemObject }) => module.default,
  );
}

function createParagraphWithRichText(richTextItem: RichTextItemObject): ParagraphBlockObject {
  return {
    type: 'paragraph',
    paragraph: {
      rich_text: [richTextItem],
    },
  } as ParagraphBlockObject;
}

function createDefaultContext(overrides: Partial<TransformContext> = {}): TransformContext {
  return {
    slug: 'test-slug',
    imageDownloads: [],
    ...overrides,
  };
}

describe('transformNotionBlocksToMarkdown', () => {
  describe('見出し', () => {
    it('heading_1はMarkdownのh1に変換される', async () => {
      const fixture = await loadFixture('block-heading-1.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '# Lacinato kale\n\n');
    });

    it('heading_2はMarkdownのh2に変換される', async () => {
      const fixture = await loadFixture('block-heading-2.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '## Lacinato kale\n\n');
    });

    it('heading_3はMarkdownのh3に変換される', async () => {
      const fixture = await loadFixture('block-heading-3.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '### Lacinato kale\n\n');
    });
  });

  describe('段落', () => {
    it('通常の段落は改行で区切られる', async () => {
      const fixture = await loadFixture('block-paragraph.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, 'Lacinato kale\n\n');
    });
  });

  describe('区切り線', () => {
    it('dividerは---に変換される', async () => {
      const fixture = await loadFixture('block-divider.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '---\n\n');
    });
  });

  describe('引用', () => {
    it('quoteは>で始まる', async () => {
      const fixture = await loadFixture('block-quote.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '> To be or not to be...\n\n');
    });
  });

  describe('コードブロック', () => {
    it('言語指定ありのコードブロック', async () => {
      const fixture = await loadFixture('block-code.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '```javascript\nconst a = 3\n```\n\n');
    });
  });

  describe('画像', () => {
    it('外部画像はMarkdown画像構文になる', async () => {
      const fixture = await loadFixture('block-image-external.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '![](https://website.domain/images/image.png)\n\n');
    });

    it('ローカル画像はslug別のディレクトリに配置された画像への参照になる', async () => {
      const fixture = await loadFixture('block-image-file.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext({ slug: 'post-slug' }));
      assert.strictEqual(result, '![](/images/post-slug/image.png)\n\n');
    });

    it('ローカル画像のダウンロードタスクがコンテキストに追加される', async () => {
      const fixture = await loadFixture('block-image-file.json');
      const context = createDefaultContext();
      const result = transformNotionBlocksToMarkdown([fixture], context);
      assert.strictEqual(result, '![](/images/test-slug/image.png)\n\n');
      assert.deepStrictEqual(context.imageDownloads, [
        {
          filename: 'image.png',
          url: 'https://website.domain/images/image.png',
        },
      ]);
    });
  });

  describe('リスト', () => {
    it('箇条書きリストは-で始まる', async () => {
      const fixture = await loadFixture('block-bulleted-list-item.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '- Lacinato kale\n\n');
    });

    it('番号付きリストは1.で始まる', async () => {
      const fixture = await loadFixture('block-numbered-list-item.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '1. Finish reading the docs\n\n');
    });
  });

  describe('数式', () => {
    it('数式ブロックは$$で囲まれる', async () => {
      const fixture = await loadFixture('block-equation.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '$$\ne=mc^2\n$$\n\n');
    });
  });

  describe('コールアウト', () => {
    it('calloutはNOTE alert構文に変換される', async () => {
      const fixture = await loadFixture('block-callout-default.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '> [!NOTE]\n> Lacinato kale\n\n');
    });

    it('emojiが ❗️ のとき、IMPORTANT alert構文に変換される', async () => {
      const fixture = await loadFixture('block-callout-important.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '> [!IMPORTANT]\n> Lacinato kale\n\n');
    });

    it('emojiが ⚠️ のとき、WARNING alert構文に変換される', async () => {
      const fixture = await loadFixture('block-callout-warning.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(result, '> [!WARNING]\n> Lacinato kale\n\n');
    });
  });

  describe('テーブル', () => {
    it('ヘッダー行ありのテーブル', async () => {
      const fixture = await loadFixture('block-table-with-header.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(
        result,
        '| column 1 content | column 2 content | column 3 content |\n| --- | --- | --- |\n| column 1 content | column 2 content | column 3 content |\n\n',
      );
    });

    it('ヘッダー行なしのテーブル', async () => {
      const fixture = await loadFixture('block-table-without-header.json');
      const result = transformNotionBlocksToMarkdown([fixture], createDefaultContext());
      assert.strictEqual(
        result,
        '|  |  |  |\n| --- | --- | --- |\n| column 1 content | column 2 content | column 3 content |\n| column 1 content | column 2 content | column 3 content |\n\n',
      );
    });
  });

  describe('リッチテキスト', () => {
    it('太字テキストは**で囲まれる', async () => {
      const richTextItem = await loadRichTextFixture('block-richtext-text-bold.json');
      const paragraph = createParagraphWithRichText(richTextItem);
      const result = transformNotionBlocksToMarkdown([paragraph], createDefaultContext());
      assert.strictEqual(result, '**bold text**\n\n');
    });

    it('斜体テキストは*で囲まれる', async () => {
      const richTextItem = await loadRichTextFixture('block-richtext-text-italic.json');
      const paragraph = createParagraphWithRichText(richTextItem);
      const result = transformNotionBlocksToMarkdown([paragraph], createDefaultContext());
      assert.strictEqual(result, '*italic text*\n\n');
    });

    it('取り消し線は~~で囲まれる', async () => {
      const richTextItem = await loadRichTextFixture('block-richtext-text-strikethrough.json');
      const paragraph = createParagraphWithRichText(richTextItem);
      const result = transformNotionBlocksToMarkdown([paragraph], createDefaultContext());
      assert.strictEqual(result, '~~strikethrough text~~\n\n');
    });

    it('インラインコードは`で囲まれる', async () => {
      const richTextItem = await loadRichTextFixture('block-richtext-text-code.json');
      const paragraph = createParagraphWithRichText(richTextItem);
      const result = transformNotionBlocksToMarkdown([paragraph], createDefaultContext());
      assert.strictEqual(result, '`inline code text`\n\n');
    });

    it('リンクは[text](url)形式になる', async () => {
      const richTextItem = await loadRichTextFixture('block-richtext-text-with-link.json');
      const paragraph = createParagraphWithRichText(richTextItem);
      const result = transformNotionBlocksToMarkdown([paragraph], createDefaultContext());
      assert.strictEqual(result, '[inline link](https://developers.notion.com/)\n\n');
    });

    it('通常のテキストはそのまま出力される', async () => {
      const richTextItem = await loadRichTextFixture('block-richtext-text-without-link.json');
      const paragraph = createParagraphWithRichText(richTextItem);
      const result = transformNotionBlocksToMarkdown([paragraph], createDefaultContext());
      assert.strictEqual(result, 'Some words \n\n');
    });
  });
});

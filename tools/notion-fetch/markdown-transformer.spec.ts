import { describe, it } from 'node:test';
import assert from 'node:assert';
import type { SpecificBlockObject, UntypedBlockObject } from './notion-types';
import { transformNotionBlocksToMarkdown } from './markdown-transformer';

// テスト用の型定義（実際のNotion APIレスポンスの構造に基づく）
interface TestRichTextItem {
  type: 'text';
  text: {
    content: string;
    link: { url: string } | null;
  };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href: string | null;
}

type TestRichTextArray = TestRichTextItem[];

interface TestBlockBase {
  object: 'block';
  id: string;
  type: string;
  created_time: string;
  created_by: { object: 'user'; id: string };
  last_edited_time: string;
  last_edited_by: { object: 'user'; id: string };
  has_children: boolean;
  archived: boolean;
  in_trash: boolean;
  parent: { type: 'page_id'; page_id: string };
}

// children プロパティを持つテーブルブロック用の型
interface TestTableBlockWithChildren extends TestBlockBase {
  type: 'table';
  table: {
    table_width: number;
    has_column_header: boolean;
    has_row_header: boolean;
  };
  children: TestTableRowBlock[];
}

interface TestTableRowBlock extends TestBlockBase {
  type: 'table_row';
  table_row: {
    cells: TestRichTextArray[];
  };
}

// テスト用のヘルパー関数
function createRichText(
  text: string,
  annotations: { bold?: boolean; italic?: boolean; strikethrough?: boolean; underline?: boolean; code?: boolean } = {},
): TestRichTextArray {
  return [
    {
      type: 'text',
      text: { content: text, link: null },
      annotations: {
        bold: annotations.bold || false,
        italic: annotations.italic || false,
        strikethrough: annotations.strikethrough || false,
        underline: annotations.underline || false,
        code: annotations.code || false,
        color: 'default',
      },
      plain_text: text,
      href: null,
    },
  ];
}

function createRichTextWithLink(text: string, url: string): TestRichTextArray {
  return [
    {
      type: 'text',
      text: { content: text, link: { url } },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: 'default',
      },
      plain_text: text,
      href: url,
    },
  ];
}

function createBaseBlock<T extends string>(id: string, type: T): TestBlockBase & { type: T } {
  return {
    object: 'block',
    id,
    type,
    created_time: '2023-01-01T00:00:00.000Z',
    created_by: { object: 'user', id: 'user-1' },
    last_edited_time: '2023-01-01T00:00:00.000Z',
    last_edited_by: { object: 'user', id: 'user-1' },
    has_children: false,
    archived: false,
    in_trash: false,
    parent: { type: 'page_id', page_id: 'page-1' },
  };
}

async function loadFixture(fixtureFilename: string): Promise<UntypedBlockObject> {
  return import(`./fixtures/${fixtureFilename}`).then((m) => m.default as UntypedBlockObject);
}

describe('transformNotionBlocksToMarkdown', () => {
  describe('見出し', () => {
    it('heading_1はMarkdownのh1に変換される', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'heading_1'),
          heading_1: {
            rich_text: createRichText('見出し1'),
            is_toggleable: false,
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '# 見出し1\n\n');
    });

    it('heading_2はMarkdownのh2に変換される', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'heading_2'),
          heading_2: {
            rich_text: createRichText('見出し2'),
            is_toggleable: false,
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '## 見出し2\n\n');
    });

    it('heading_3はMarkdownのh3に変換される', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'heading_3'),
          heading_3: {
            rich_text: createRichText('見出し3'),
            is_toggleable: false,
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '### 見出し3\n\n');
    });
  });

  describe('段落', () => {
    it('通常の段落は改行で区切られる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'paragraph'),
          paragraph: {
            rich_text: createRichText('通常の段落テキストです。'),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '通常の段落テキストです。\n\n');
    });

    it('太字テキストは**で囲まれる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'paragraph'),
          paragraph: {
            rich_text: createRichText('太字テキスト', { bold: true }),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '**太字テキスト**\n\n');
    });

    it('斜体テキストは*で囲まれる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'paragraph'),
          paragraph: {
            rich_text: createRichText('斜体テキスト', { italic: true }),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '*斜体テキスト*\n\n');
    });

    it('取り消し線は~~で囲まれる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'paragraph'),
          paragraph: {
            rich_text: createRichText('取り消し線', { strikethrough: true }),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '~~取り消し線~~\n\n');
    });

    it('インラインコードは`で囲まれる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'paragraph'),
          paragraph: {
            rich_text: createRichText('コード', { code: true }),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '`コード`\n\n');
    });

    it('リンクは[text](url)形式になる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'paragraph'),
          paragraph: {
            rich_text: createRichTextWithLink('Google', 'https://www.google.com'),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '[Google](https://www.google.com)\n\n');
    });
  });

  describe('区切り線', () => {
    it('dividerは---に変換される', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'divider'),
          divider: {},
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '---\n\n');
    });
  });

  describe('引用', () => {
    it('quoteは>で始まる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'quote'),
          quote: {
            rich_text: createRichText('これは引用です。'),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '> これは引用です。\n\n');
    });
  });

  describe('コードブロック', () => {
    it('言語指定なしのコードブロック', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'code'),
          code: {
            rich_text: createRichText('console.log(\"hello\");'),
            language: 'plain text',
            caption: [],
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '```\nconsole.log(\"hello\");\n```\n\n');
    });

    it('TypeScript言語指定のコードブロック', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'code'),
          code: {
            rich_text: createRichText('const x: number = 42;'),
            language: 'typescript',
            caption: [],
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '```typescript\nconst x: number = 42;\n```\n\n');
    });
  });

  describe('画像', () => {
    it('外部画像はMarkdown画像構文になる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'image'),
          image: {
            type: 'external',
            external: { url: 'https://example.com/image.png' },
            caption: createRichText('代替テキスト'),
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '![代替テキスト](https://example.com/image.png)\n\n');
    });

    it('ローカル画像もMarkdown画像構文になる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'image'),
          image: {
            type: 'file',
            file: { url: 'https://files.notion.so/image.png' },
            caption: createRichText('ローカル画像'),
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '![ローカル画像](/images/slug/image-id.png)\n\n');
    });
  });

  describe('リスト', () => {
    it('箇条書きリストは-で始まる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'bulleted_list_item'),
          bulleted_list_item: {
            rich_text: createRichText('リストアイテム1'),
            color: 'default',
          },
        },
        {
          ...createBaseBlock('2', 'bulleted_list_item'),
          bulleted_list_item: {
            rich_text: createRichText('リストアイテム2'),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '- リストアイテム1\n- リストアイテム2\n\n');
    });

    it('番号付きリストは1.で始まる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'numbered_list_item'),
          numbered_list_item: {
            rich_text: createRichText('番号付きアイテム1'),
            color: 'default',
          },
        },
        {
          ...createBaseBlock('2', 'numbered_list_item'),
          numbered_list_item: {
            rich_text: createRichText('番号付きアイテム2'),
            color: 'default',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '1. 番号付きアイテム1\n2. 番号付きアイテム2\n\n');
    });
  });

  describe('数式', () => {
    it('数式ブロックは$$で囲まれる', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'equation'),
          equation: {
            expression: 'e=mc^2',
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '$$\ne=mc^2\n$$\n\n');
    });
  });

  describe('コールアウト', () => {
    it('calloutはinfo alert構文に変換される', () => {
      const blocks: SpecificBlockObject[] = [
        {
          ...createBaseBlock('1', 'callout'),
          callout: {
            rich_text: createRichText('これは重要な情報です。'),
            color: 'default',
            icon: { type: 'emoji', emoji: '💡' },
          },
        },
      ] as SpecificBlockObject[];

      const result = transformNotionBlocksToMarkdown(blocks);
      assert.strictEqual(result, '> [!INFO]\n> これは重要な情報です。\n\n');
    });
  });

  describe('テーブル', () => {
    it('ヘッダー行ありのテーブル', async () => {
      const fixture = await loadFixture('block-table-with-header.json');
      const result = transformNotionBlocksToMarkdown([fixture]);
      assert.strictEqual(
        result,
        '| column 1 content | column 2 content | column 3 content |\n| --- | --- | --- |\n| column 1 content | column 2 content | column 3 content |\n\n',
      );
    });

    it('ヘッダー行なしのテーブル', async () => {
      const fixture = await loadFixture('block-table-without-header.json');
      const result = transformNotionBlocksToMarkdown([fixture]);
      assert.strictEqual(
        result,
        '|   |   |   |\n| --- | --- | --- |\n| column 1 content | column 2 content | column 3 content |\n| column 1 content | column 2 content | column 3 content |\n\n',
      );
    });
  });
});

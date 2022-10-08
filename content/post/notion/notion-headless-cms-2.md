---
title: 'NotionヘッドレスCMS化記録 (2) ページプロパティの読み取りとMarkdown生成'
date: '2022-02-13T23:59:00.000Z'
updated_at: '2022-02-14T00:43:00.000Z'
tags:
  - 'Notion'
  - 'TypeScript'
  - 'Markdown'
draft: false
source: 'https://www.notion.so/Notion-CMS-2-Markdown-4047b3f13e884bcab2757dd81a6eef99'
---

{{< embed "https://blog.lacolaco.net/2022/02/notion-headless-cms-1/" >}}

前回に引き続き、今回は Notion API で取得したページのデータから記事の Markdown ファイルを生成するまでに苦労した点を書いていきたい。

## ページプロパティの読み取り

前回は Notion 公式の JavaScript 向けクライアントライブラリ（以下 `@notionhq/client`) を使ってページやブロックのデータを取得した。

[https://github.com/makenotion/notion-sdk-js](https://github.com/makenotion/notion-sdk-js)

最終的に Hugo で記事としてビルド可能な Markdown ファイルを生成するためには、記事のタイトルやタグなどを保持する Frontmatter 情報と、記事の本文の情報の両方を Notion のページから読み取って変換しなければならない。

しかしこれも思いどおりにはいかず、いくつかの工夫が必要だった。

### ページプロパティオブジェクトのキーが ID じゃない

前回の記事で `PageObject` 型が `properties` フィールドを持つように型を定義したが、このフィールドで提供されるページプロパティ情報がなかなか扱いづらいデータモデルだった。

Notion のページプロパティはページに紐付けられるメタ情報のセットで、次の画像のようなプロパティ名と値の Key-Value マップのデータである。

{{< figure src="/img/notion-headless-cms-2/a91ff2bf-6fba-4f51-a2f8-780243849007/Untitled.png" caption="ページプロパティ" >}}

問題はこのプロパティ情報を格納した `PageObject` の `properties` オブジェクトが、自由記述のプロパティ表示名をキーとして、プロパティ固有の ID が値側に格納されていることである。

```typescript
  properties: Record<string, {
      type: "title";
      title: Array<RichTextItemResponse>;
      id: string;
  } | {
      type: "rich_text";
      rich_text: Array<RichTextItemResponse>;
      id: string;
  } | ...
  }>;
```

Notion の GUI 上ではいつでもプロパティ表示名を変更できるため、キー側をもとに特定のプロパティを探索するのは堅牢性に欠ける。まずはプロパティの ID をキーにしたマップオブジェクトに詰め替えることから始めることになった。

```typescript
const properties = Object.fromEntries(
  Object.values(page.properties).map((prop) => [prop.id, prop]),
);
```

### プロパティの型をプロパティタイプから推論する

Notion のページプロパティはいくつものデータ型をサポートしており、プロパティオブジェクトの `type` フィールドからその種別を特定できる。逆にいえば、プロパティ ID で取得しただけではすべてのデータ型の Union 型になっているためそれぞれのデータ型固有のフィールドにアクセスできない。

そこで、プロパティのマップオブジェクトからデータ型を指定しつつ特定のプロパティを取り出すために、次のようなユーティリティ関数を作成した。ID とデータ型が一致すればそのプロパティを返し、一致しなければ `null` を返す。そして取り出したプロパティは Type Guard によりデータ型が確定する。

```typescript
export function createPagePropertyMap(page: PageObject) {
  const properties = Object.fromEntries(
    Object.values(page.properties).map((prop) => [prop.id, prop]),
  );
  return {
    get<PropType extends string>(id: string, type: PropType) {
      const prop = properties[id];
      if (!prop || !matchPropertyType(prop, type)) {
        return null;
      }
      return prop;
    },
  } as const;
}

function matchPropertyType<
  PropType extends string,
  Prop extends { type: string },
>(
  property: Prop,
  type: PropType,
): property is MatchType<Prop, { type: PropType }> {
  return property.type === type;
}
```

このユーティリティを使ってページプロパティ情報からブログ記事のメタデータとなる Frontmatter 情報が作成できるようになった。

```typescript
async renderPost(post: NotionPost, options: { forceUpdate?: boolean } = {}) {
  const { created_time: remoteCreatedAt, last_edited_time: remoteUpdatedAt, archived } = post;
  if (archived) {
    return;
  }
  const props = createPagePropertyMap(post);
  const title = props.get('title', 'title')?.title[0]?.plain_text;
  const slug = props.get('Y~YJ', 'rich_text')?.rich_text[0]?.plain_text ?? null;
  const tags = props.get('v%5EIo', 'multi_select')?.multi_select.map((node) => node.name) ?? [];
  const publishable = props.get('vssQ', 'checkbox')?.checkbox ?? false;
  if (title == null || slug == null) {
    console.warn(`title or slug is null: ${JSON.stringify(post, null, 2)}`);
    return;
  }
	const frontmatter = renderFrontmatter({
    title,
    date: remoteCreatedAt,
    updated_at: remoteUpdatedAt,
    tags,
    draft: !publishable,
    source: post.url,
  });
	// ...
}

export function renderFrontmatter(params: Record<string, unknown>): string {
  const frontmatter = yaml.dump(params, { forceQuotes: true });
  return [`---`, frontmatter, `---`].join('\n');
}
```

## Markdown ファイルの生成

ページのブロックデータをもとに Markdown 文字列へ変換し、記事ファイルとして書き込むのはそれほど苦労しなかったが、注意するポイントはあった。

### ファイルアップロードの画像ブロックは URL が失効する

Notion の画像ブロックは外部 URL を指定するものと、Notion へ直接画像をアップロードして埋め込むものと 2 種類あるが、ファイルアップロードによる画像ブロックは URL が一定時間で失効する。そのため、ブログ記事として永続化させるためには URL が生きているうちに画像をダウンロードし、レポジトリ内へ保存したうえで相対パスによって参照することになる。

```typescript
const renderer: BlockObjectRendererMap = {
  // ...
  image: async (block) => {
    switch (block.image.type) {
      case 'external':
        return `![${block.image.caption}](${block.image.external.url})\n\n`;
      case 'file':
        // 画像をDLしてローカルファイルの相対パスを返す
        const imagePath = await externalImageResolver(block.image.file.url);
        return `![${block.image.caption}](/img/${imagePath})\n\n`;
    }
  },
  // ...
} as const;
```

### ネストしたリストは子ブロック扱い

前回の記事でも触れたが、箇条書きリスト、番号付きリストはネストさせると子ブロックを持つようになる。ネストの深さに応じてインデントされるように、前回保持させた `depth` フィールドを使う。

```typescript
    bulleted_list_item: (block) => {
      const indent = '\t'.repeat(block.depth);
      const text = renderRichTextArray(block.bulleted_list_item.text);
      return `${indent}- ${text}\n`;
    },
    numbered_list_item: (block) => {
      const indent = '\t'.repeat(block.depth);
      const text = renderRichTextArray(block.numbered_list_item.text);
      return `${indent}1. ${text}\n`;
    },
```

### リッチテキストの変換

Notion のテキストはほとんどのブロックでリッチテキストとして表現され、文字装飾が可能だ。すべての装飾を Markdown へ変換しても保持するのは大変なので、ブログ記事として必要なものに絞って変換した。 `annotations` のそれぞれのフラグは排他ではなくすべての組み合わせがありえるため、優先順をつけて再帰的に処理することとした。ブログ側ではインラインコードの装飾は除去し、Markdown 側で 2 文字のマーカーが必要なものから順番に処理する。リンクや改行の処理は最後になるようにした。

```typescript
type RichTextObject = {
  plain_text: string;
  href: string | null;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
  };
};

function renderRichTextArray(array: RichTextObject[]): string {
  return array.map(renderRichText).join('');
}

function renderRichText(richText: RichTextObject): string {
  const { plain_text, href, annotations } = richText;
  if (annotations.code) {
    return `\`${plain_text}\``;
  }
  if (annotations.bold) {
    return renderRichText({
      ...richText,
      plain_text: `**${plain_text}**`,
      annotations: { ...annotations, bold: false },
    });
  }
  if (annotations.italic) {
    const mark = plain_text.startsWith('*') ? '_' : '*';
    return renderRichText({
      ...richText,
      plain_text: `${mark}${plain_text}${mark}`,
      annotations: { ...annotations, italic: false },
    });
  }
  if (annotations.strikethrough) {
    return renderRichText({
      ...richText,
      plain_text: `~~${plain_text}~~`,
      annotations: { ...annotations, strikethrough: false },
    });
  }
  if (annotations.underline) {
    return renderRichText({
      ...richText,
      plain_text: `__${plain_text}__`,
      annotations: { ...annotations, underline: false },
    });
  }
  if (href) {
    return renderRichText({
      ...richText,
      plain_text: `[${plain_text}](${href})`,
      href: null,
    });
  }
  if (plain_text.includes('\n')) {
    return plain_text.replace(/\n/g, '  \n');
  }
  return plain_text;
}
```

## まとめ・次回予告

こうして Notion API から取得したページデータをもとに Markdown ファイルを生成することができた。

次回は、この記事生成を含むデプロイフローが Notion で記事を書いたあと自動的に実行されるようにするための、GitHub Actions のワークフローについて書く。

---
title: 'NotionヘッドレスCMS化記録 (1) Notion APIとTypeScript'
date: '2022-02-13T10:22:00.000Z'
tags:
  - 'tech'
  - 'Notion'
  - 'TypeScript'
draft: false
source: 'https://www.notion.so/Notion-CMS-1-Notion-API-TypeScript-0d887003a8d1457fa6bec484dfcb2346'
---

このブログ [https://blog.lacolaco.net](https://blog.lacolaco.net) は [Hugo](https://gohugo.io) で生成しており、これまでは Markdown ファイルをローカルで手書きして記事を書いていた。そしてより気軽に記事を書ける環境を求めて、 [Notion](https://notion.so) をヘッドレス CMS として使ってみることにした。ちなみにこの記事も Notion で書いている。

この試みは特に新しいものではないため、それほど苦労せず実現できるだろうと思っていたが、実際に開発してみると思っていたよりも苦労した。そこでこの記事から何回かに分けて、Notion をヘッドレス CMS として使うにあたっての困難とそれを乗り越えるための工夫について書き残す。

今回の内容は Notion の開発者向け API と SDK を TypeScript で利用するにあたって苦労した点だ。

## Notion JavaScript Client

[公式ドキュメント](https://developers.notion.com/docs/getting-started) に書かれているように、Notion API は公式の JavaScript 向けクライアントライブラリ（以下 `@notionhq/client`) が提供されている。

[https://github.com/makenotion/notion-sdk-js](https://github.com/makenotion/notion-sdk-js)

ライブラリのパッケージは npm で配布されているため、誰でも簡単に Notion API を使ったアプリケーションを開発できる。また、 `@notionhq/client` のコードベースは TypeScript で書かれているため、TypeScript プロジェクトで利用すれば静的型の支援を受けながら開発できる…と思っていたが、ここに少し落とし穴があった。

### データモデル単体の型定義が公開されていない

Notion API で取得するページやブロックなどのデータは、各 API エンドポイントのレスポンス型に内包される形でしかアクセスできない。つまり、`@notionhq/client` から `PageObject` や `BlockObject` などの独立した型定義がインポートできない。ソースコードを見れば内部的に定義されているものは見つけられるが、パブリック API としては提供されていない。

API 呼び出しからレスポンスデータの処理をまとめて書いてしまうならそれほど困らないが、ソースコードを構造化し、モジュールごとに責務を分割したいと思ったら、個々のデータモデルを引数として受け取る関数が記述できないのは困りものだった。

結局この問題は API 呼び出しメソッドの `ReturnType` 型から内部のモデル部分の型を取り出すことにした。Promise を返すメソッドであるため `Awaited` 型も併用し、さらに配列の要素の型を取り出すために自作の `ElementType<T>` 型も用意した。

```typescript
// utils-types.d.ts
declare type ElementType<T> = T extends (infer U)[] ? U : never;

// notion/types.ts
import { Client } from '@notionhq/client';

export type PageObject = ElementType<
  Awaited<ReturnType<Client['databases']['query']>>['results']
>;

export type BlockObject = ElementType<
  Awaited<ReturnType<Client['blocks']['children']['list']>>['results']
>;
```

これでページオブジェクトを引数に取る関数が記述できるようになったと思ったが、まだこれだけでは実用的ではなかった。

### データモデルの Union 型が親切じゃない

ページオブジェクトにはページのプロパティ情報を格納した `properties` フィールドがあるが、上述の型定義で取り出した `PageObject` 型にはそれが存在しない。正しくは、 `properties` フィールドをもたない型との Union 型になっているため、Type Guard を通さないとアクセスできない。

```typescript
// Client.databases.query.resultsの型定義
    results: Array<{
        ...
        properties: Record<string, ...> | null;
        object: "page";
        id: string;
        ...
    } | {
        object: "page";
        id: string;
    }>;
```

今回のユースケースでは `properties` を持たないページはイレギュラーでしかないため、この型定義のまま扱うと Type Guard を何度も書くことになる。そこで `PageObject` 型が常に `properties` フィールドを持つように、独自のユーティリティ型として `MatchType<T, U>` を作成し、次のようにして `properties` フィールドの存在を保証した。また同様に、 `BlockObject` も `type` フィールドの存在を保証するように定義した。

```typescript
// util-types.d.ts
declare type MatchType<T, U, V = never> = T extends U ? T : V;

// notion/types.ts
export type PageObject = MatchType<
  ElementType<Awaited<ReturnType<Client['databases']['query']>>['results']>,
  {
    properties: unknown;
  }
>;

export type BlockObject = MatchType<
  ElementType<
    Awaited<ReturnType<Client['blocks']['children']['list']>>['results']
  >,
  {
    type: unknown;
  }
>;
```

これで型の問題は解決したと思ったが、もうひとつ重大な問題が残っていた。

### ネストしたブロックがレスポンスに含まれていない

Notion においてページオブジェクトはブロックオブジェクトでもあり、ページのコンテンツはページ（ブロック）を親とする子ブロックのリストとして表現される。そして、あるブロックの子ブロックを取得する API は、**ネストした孫レベルのブロックをレスポンスに含まない**。

[https://developers.notion.com/reference/get-block-children](https://developers.notion.com/reference/get-block-children)

> Returns only the first level of children for the specified block. See [block objects](https://developers.notion.com/reference/block)  
>  for more detail on determining if that block has nested children.

孫レベルのブロックそのものはレスポンスに含まれていないが、各ブロックオブジェクトは `has_children` フィールドを持っており、これが真であればそのブロックを親とする孫ブロックがあることを示す。

つまり、ページに含まれるコンテンツをすべて取得したいと思ったら、ページ直下の子ブロックだけでなく、その子ブロックのうち `has_children` が真であるブロックの子ブロックをさらに取得する必要がある。この問題を解決するため、独自に `depth` という再帰呼び出しの深さを保持するフィールドを用意し、末端まですべてのブロックを取得できるようにした。また、 `depth` と `children` を `BlockObject` 型に加え、型定義が本当に完成した。

```typescript
// notion/types.ts
import { Client } from '@notionhq/client';

export type PageObject = MatchType<
  ElementType<Awaited<ReturnType<Client['databases']['query']>>['results']>,
  {
    properties: unknown;
  }
>;

export type BlockObject = MatchType<
  ElementType<Awaited<ReturnType<Client['blocks']['children']['list']>>['results']>,
  { type: unknown }
> & {
  depth: number;
  children?: BlockObject[];
};

// notion/api.ts
async fetchChildBlocks(parentId: string, depth = 0): Promise<BlockObject[]> {
  const blocks: BlockObject[] = [];
  let cursor = null;
  do {
    const { results, next_cursor, has_more } = await this.client.blocks.children.list({
      block_id: parentId,
    });
    for (const block of results) {
      if ('type' in block) {
        if (block.has_children) {
          const children = await this.fetchChildBlocks(block.id, depth + 1);
          blocks.push({ ...block, depth, children });
        } else {
          blocks.push({ ...block, depth });
        }
      }
    }
    cursor = has_more ? next_cursor : null;
  } while (cursor !== null);
  return blocks;
}
```

## まとめ・次回予告

Notion をブログのヘッドレス CMS として利用するシステムの開発にあたって、Notion API と TypeScript に関するいくつかの困難を非公開 API や `any` に頼らずどうにか乗り越えられた。

ここからは、API から取得したデータをもとに Markdown ファイルを生成し、ブログのデプロイフローへ組み込んでいくが、ここにもいろいろと苦労した点があったのでそれらはまた次回に。

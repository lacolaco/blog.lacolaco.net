---
title: 'merge-graphql-schemasを使ってGraphQLのスキーマファイルを結合する'
slug: 'merge-graphql-schemas'
icon: ''
created_time: '2018-02-18T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'GraphQL'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/merge-graphql-schemas-GraphQL-bc3234bd380a4b3b9f5ad78c9b784cbe'
features:
  katex: false
  mermaid: false
  tweet: false
---

[GraphQL Schemaをファイル分割してドキュメンテーションする](../modular-graphql-schema-documentation/)

^の続きです。 前回は glob と fs を使って`schema/**/*.gql`ファイルを結合し、graphdoc を使ってドキュメンテーションページを生成する記事を投稿しました。

まったく同じ目的のために `merge-graphql-schemas` という npm パッケージがあったので、これを使ってドキュメンテーションのビルドスクリプトを改良しました。

## パッケージのインストール

前回の状態から、`glob`をアンインストールして、代わりに`merge-graphql-schemas`をインストールします。

```
$ yarn remove glob
$ yarn add --dev merge-graphql-schemas
```

## `schema.js`の変更

前回は`schema.js`からエクスポートした文字列配列をスキーマとして graphdoc に読み込ませましたが、 今回は`schema.js`を実行することで静的な`schema.gql`ファイルを書き出し、これを graphdoc に渡します。

結合されたスキーマが静的ファイルとして存在することで、他の GraphQL 周辺ツール（コード生成など）への連携が容易になります。

`schema.js`は次のように書きました。`fileLoader`と`mergeTypes`が`merge-graphql-schemas`パッケージから提供される関数です。

最終的に結合された文字列が`schema.gql`ファイルに書き出されます。

やっていることは前回とだいたい同じですが、この関数でマージされたスキーマは内部でスキーマ単位にソートされていて、ファイル名ではなく`type`や`interface`の名前でソートされているようです。

```
const path = require("path");
const fs = require("fs");
const { fileLoader, mergeTypes } = require("merge-graphql-schemas");

const typesArray = fileLoader("schema/**/*.{gql,graphql}", {
  recursive: true
});

const mergedSchema = mergeTypes(typesArray);

fs.writeFileSync("schema.gql", mergedSchema, { encoding: "utf8" });
```

こんな感じで、`schema`から順番に何らかのルールでソートされています。

```
schema {
  query: Query
  mutation: Mutation
}

type Query {
  # Return the hero by episode.
  hero(episode: Episode): Character
  # Return the Human by ID.
  human(id: ID!): Human
  # Return the Droid by ID.
  droid(id: ID!): Droid
}

type Mutation {
  # Save the favorite episode.
  favorite(episode: Episode!): Episode
}

# A character in the Star Wars Trilogy
interface Character {
  id: ID!
  name: String
  friends: [Character]
  appearsIn: [Episode]
  secretBackstory: String
}
...
```

## graphdoc でスキーマを読み込む

`package.json`の`build`スクリプトを次のように変更します。事前に`schema.js`を実行し、吐き出されたファイルを`graphdoc`に渡します。

```
  "scripts": {
    "build": "node schema.js && graphdoc -s schema.gql -o docs -f"
  },
```

これで元どおりドキュメンテーションが生成されます。

---

`schema.gql`を静的に吐き出して Git 管理に含めておくと、このリポジトリを外部から参照することで簡単に GraphQL のスキーマが得られるので、 クライアントサイドとサーバーサイドそれぞれから参照して利用するのに便利です。`.gql`ファイルなので実装の言語も問いません。

この方法で作成したスキーマから TypeScript の型定義を生成してクライアントサイドで利用するのを仕事で試しているので、いい感じに知見が溜まったらまた記事を書きます。

だんだん API 仕様中心開発っぽくなってきたぞ！さらばバックエンド実装にブロックされるフロントエンド開発！

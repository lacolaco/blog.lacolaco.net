---
title: 'GraphQL Schemaをファイル分割してドキュメンテーションする'
slug: 'modular-graphql-schema-documentation'
icon: ''
created_time: '2018-02-13T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
tags:
  - 'GraphQL'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/GraphQL-Schema-cada7ee019fd4cc1b74d399d78d01d80'
features:
  katex: false
  mermaid: false
  tweet: false
---

GraphQL の Schema から静的なドキュメンテーションページを生成するツールとして、graphdoc というものがあります。

https://github.com/2fd/graphdoc

GraphQL Schema を渡すと、こんな感じの HTML を生成してくれます。 これは GraphQL 公式のサンプルにもある Star Wars API の例。

https://2fd.github.io/graphdoc/star-wars/

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180213/20180213222120.png)

このドキュメンテーションを 複数の`*.gql`ファイルからなる Schema から生成するために少し小細工が必要だったので紹介します。

## GraphQL Schema Language

今回は GraphQL Schema Language を`.gql`という拡張子のファイル（便宜的に以降 `gqlファイル` と呼びます）で管理します。 TypeScript や JavaScript ファイル中でテンプレートリテラルとして管理するよりも余計なコードがなくて見やすく、エディタによっては入力支援も得られます。

gql ファイルの欠点は、GraphQL Schema Language に外部ファイルの参照の仕様がないことです。 JSON Schema でいう`$ref`に相当するものが定義されていないので、エントリポイントとなる Schema から分割された型定義などを参照できません。

## graphdoc で gql ファイルをドキュメンテーションする

graphdoc はいくつかの方法で Schema を読み込めます。 代表的なものはエンドポイント URL を渡して HTTP 経由でドキュメンテーションを生成する機能ですが、 gql ファイルを渡すこともできます。 しかし gql ファイルを渡す場合は先述の理由により単一ファイルにすべての Schema が記述されている必要があるので、 大きな API 仕様になると管理が大変です。

複数の gql ファイルからなる Schema を graphdoc で読み込むためには、JavaScript 読み込み機能を使います。 graphdoc の`schemaFile`として`.js`ファイルを渡すと、CommonJS として読み込まれ、`exports.default`の値を Schema として使用します。 そしてこのとき、エクスポートするのは Schema の**配列**なので、複数の gql ファイルを読み込んで文字列として渡してあげれば目的を達成できます。

### 手順

### npm パッケージを揃える

必要なのは`@2fd/graphdoc`と`glob`の 2 つです

```
> yarn add --dev @2fd/graphdoc glob
```

### `schema.js`ファイルを記述する

**複数の gql ファイルを読み込んで文字列として渡してあげ**るための JavaScript ファイルを用意します。 `glob`と`fs`を使ってファイルを読み込むだけですが、同期的にエクスポートする必要があるのに注意します。

```
const glob = require("glob");
const fs = require("fs");
const path = require("path");

function loadSchemas() {
  const files = glob.sync("schema/**/*.{gql,graphql}");

  return files.map(file =>
    fs.readFileSync(path.resolve(file), { encoding: "utf8" })
  );
}

const schemas = loadSchemas();
exports.default = schemas;
```

### npm script を追加する

`graphdoc`コマンドを実行する npm スクリプトを追加します

```
  "scripts": {
    "build": "graphdoc -s schema.js -o docs -f"
  },
```

### `schema`ディレクトリに gql ファイルを配置する

あとはひたすら Schema を書いていくだけです。

実際に Staw Wars API の Schema を分割して graphdoc にしたリポジトリを用意したので、詳細はそちらを参照してください。

https://github.com/lacolaco/graphdoc-example

`docs`ディレクトリに出力しているので、GitHub Pages で簡単に API ドキュメントをホストできます。

https://lacolaco.github.io/graphdoc-example/

## 課題

- gql ファイルに外部参照の仕組みがないので、分割すると参照が途切れる（リネームとかできない）

サーバーサイドの実装に依存しない API 仕様 Centric な開発をしたいのだけど、 Open API Specification みたいな感じで GraphQL Schema を使う文化はあまり育っていないようで、苦労しそうな感じがあります。

結局のところひとつの gql ファイルにドカドカ型定義書いていくほうが楽なのかもしれないけど、しばらく分割管理を試してみてから考えましょう。


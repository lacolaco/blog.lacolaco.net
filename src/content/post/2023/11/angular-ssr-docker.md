---
title: 'Angular SSR on Docker'
slug: 'angular-ssr-docker'
icon: ''
created_time: '2023-11-12T14:38:00.000Z'
last_edited_time: '2023-12-30T09:59:00.000Z'
tags:
  - 'Angular'
  - 'Docker'
published: true
locale: 'ja'
category: 'Idea'
notion_url: 'https://www.notion.so/Angular-SSR-on-Docker-ee8cd85b3e4f48ddb84db63d473cc5d7'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular v17で簡単になったSSRを、Dockerでビルドしてデプロイできるようにする。やることは単純で、特に落とし穴になるようなことはない。

まずは `ng new` コマンドでアプリケーションを作成する。 `--ssr` フラグをつけなくても、プロンプトでSSRを有効にするかどうかは尋ねられるので、そこでYesと答えてもよい。

```shell
$ ng new ng17-ssr-docker --ssr
```

正しくアプリケーションを作成できていれば、この時点で `ng build` を実行すればSSR用のサーバーを立てるのに必要なファイルと設定はすべて済んでいる。ビルドを実行して出力された `dist/server` ディレクトリが存在すれば問題ない。

```shell
$ npm run build
$ tree dist/
dist/
└── ng17-ssr-docker
    ├── 3rdpartylicenses.txt
    ├── browser
    │   ├── favicon.ico
    │   ├── index.html
    │   ├── main-XALV5XXG.js
    │   ├── polyfills-LZBJRJJE.js
    │   └── styles-5INURTSO.css
    ├── prerendered-routes.json
    └── server
        ├── chunk-53JWIC36.mjs
        ├── chunk-KRLCULJA.mjs
        ├── chunk-VP7Q5FIC.mjs
        ├── chunk-YGUSPAT3.mjs
        ├── index.server.html
        ├── main.server.mjs
        ├── polyfills.server.mjs
        ├── render-utils.server.mjs
        └── server.mjs
```

この中の `server/server.mjs` をNode.jsで実行するとサーバーが起動する。試しに `node` コマンドを実行して確認しよう。デフォルトではlocalhostの4000番ポートでサーバーが起動するので、ブラウザで開いてSSRされたHTMLが返却されていることがわかるはずだ。

```shell
$ node dist/ng17-ssr-docker/server/server.mjs
Node Express server listening on http://localhost:4000
```

あとはこれを任意のNode.js環境にデプロイすればいい。Dockerを使う場合、最小構成は次のようになる。やることは、ビルド後の `dist` ディレクトリの中身をコピーし、 `server/server.mjs` を実行するだけだ。サーバーサイドのスクリプトもAngular CLIによってバンドルされているため、実行環境で `npm install` をする必要はない。

```docker
FROM node:20-buster-slim
WORKDIR /app
COPY dist/ng17-ssr-docker/ /app
CMD node server/server.mjs
```

ビルドもDockerに任せたい場合はマルチステージビルドを使ってもよいが、個人的にはおすすめしない。昨今いろいろなCLIツールは永続キャッシュによる高速化が図られていることが多く、Dockerでビルドさせるとその恩恵が得にくいケースが多い。工夫すればできないことはないだろうが、物事をシンプルに保つうえであらかじめ `ng build` しておいた結果をコピーするだけに留めておくほうがよかろうと思う。

あとは適当にDockerイメージをビルドしてデプロイすれば終わりだ。いやあ簡単になったものだ。


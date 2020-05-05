---
title: "Nx: Angular+Nest.jsアプリをDockerビルドする"
date: 2020-04-29T22:09:17+09:00
tags: ["nx","docker","angular","nestjs"]
foreign: true
---

本稿では [Nx](nx.dev) を使ったAngular+Nest.jsのmonorepoアプリケーションを単一のDockerイメージとしてデプロイ可能にする手順を記す。

サンプルコードの最終的な状態は以下のリポジトリに公開している。

https://github.com/lacolaco/nx-angular-nest-docker-example

## 0. 背景

一般的にはSingle Page Applicationのクライアントとサーバーは別のコンテナとしてデプロイされNginxなどで静的ファイルへのリクエストとAPIリクエストを振り分けることが多いが、今回はあえて単一のDockerコンテナでHTTPサーバーを立ち上げ、そのサーバーから静的ファイルとしてクライアントをサーブする。
なぜかというと、今回は[Google Cloud  Run](https://cloud.google.com/run?hl=ja)にアプリケーションをデプロイすることが目的だからだ。Cloud Runには単一のDockerfileからビルドされるイメージをデプロイできる。

利点としては、まず環境がCloud Runだけで完結すること。そしてクライアントとサーバーあわせたEnd-to-Endの整合性がとりやすいことがある。
欠点としては個別にデプロイできないことや静的ファイルに特化した配信戦略を取りにくいことだ。ただしCloud RunはFirebase Hostingと連携することでGoogleのCDN網を利用できるため、静的ファイルに適切なレスポンスヘッダをつければFirebase Hostingと同じCDNでのキャッシュが機能する。

## 1. workspaceの作成

まずはNxのworkspaceを作成する。 `create-nx-workspace` コマンドを使い、今回は `angular-nest` を選択するが、本稿の趣旨においては別に `react-express` でも違いはない。

```shell
$ npx create-nx-workspace@latest angular-nest-docker-example`
```

## 2. outputPathの変更 (client, server)

`angular-nest` テンプレートのデフォルトで生成されるプロジェクトは、クライアントサイドが `<application-name>` 、サーバーサイドが `api` となっている。これをそれぞれ `dist/apps/client` と `dist/apps/server` にビルド結果が出力されるようにする。

<img width="1058" alt="image.png (61.2 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/b4788f7b-46f4-4f81-a245-2e21d073a9ef.png">

<img width="1030" alt="image.png (55.0 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/ab9b76d1-9c44-4046-b035-14ff8552e70d.png">

## 3. `@nestjs/serve-static` の追加 (server)

クライアントサイドをビルドした生成物をNest.jsがサーブできるように、静的ファイル配信用のモジュールを追加する。

```shell
$ yarn add @nestjs/serve-static`
```

静的ファイルはさきほど変更したoutputPathのとおり、clientとserverが隣接するディレクトリになるため、ルートディレクトリには `../client` を指定する。 `/api*` はAPIのエンドポイントにマッチするように除外しておく。

```ts:app.module.ts (server)
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import * as path from 'path';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: path.join(__dirname, '..', 'client'),
      exclude: ['/api*']
    })
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule {}

```

加えて、APIのエンドポイントが `/api/hello` となるように `main.ts` と `app.controller.ts` も微修正する。

<img width="1150" alt="image.png (91.4 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/14911365-d4a5-45d3-a2fb-db9cb9af9aa3.png">

<img width="864" alt="image.png (48.6 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/551cf696-a389-4509-adde-96b69baa6435.png">


## 5. プロジェクト間依存関係の設定 

サーバーサイドがクライアントサイドのビルド生成物を配信するということは、サーバーサイドからクライアントサイドへのビルド順番の依存関係があるということだ。このプロジェクト間の依存関係は `nx.json` で定義できる。

<img width="1028" alt="image.png (73.2 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/4089b50f-d651-47f3-9a43-7888c00ef520.png">

`nx dep-graph` コマンドで依存関係を可視化すると以下のようになる。

<img width="1874" alt="image.png (154.4 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/db993e3d-b3ac-4ee2-bb8e-fa01c2fb064f.png">

この状態になっていると、サーバーサイドをビルドする際に自動的にクライアントサイドのビルドを先に実行することができる。

```shell
$ nx build api --with-deps
```

<img width="1310" alt="image.png (204.0 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/a63eddd9-ca08-4b8b-af13-1aa8029bd80a.png">

これでmonorepo内の依存関係を解決した上で `dist` ディレクトリに生成物を出力できるようになった。ためしに `dist/apps/server/main.js` を実行すれば、AngularアプリケーションがNest.jsのAPIを実行するアプリケーションが起動できる。

## 6. Dockerfileの作成

Dockerfileを作ってデプロイ可能なイメージをビルドするが、その前にいくつか準備が必要になる。

まず、今のバージョン（Nx v9.2.3）の `angular-nest` で生成される `package.json` から、`postinstall` の `ngcc` の実行スクリプトを削除する。これがあるとDockerfile内でモジュールをインストールしたときに不要な処理が実行される。

<img width="1510" alt="image.png (32.2 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/e16b8950-ff65-4705-982f-124bb24fe7eb.png">

次に、サーバーの `main.ts` が使用する環境変数を `port` から `PORT` に変更する。どちらでもよいが一般的に大文字のほうを使うため変更した。

<img width="928" alt="image.png (53.7 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/907fd1e3-f772-4575-bf11-4a5a68b20930.png">

そしてDockerfileは次のような形にした。Nxのビルドはサーバーサイドもバンドルするため、本当はDockerfileでは `node_modules` のインストールをしたくないのだが、Nest.jsが `tslib` が見つからずエラーになってしまうため仕方なくインストールしている。

```Dockerfile
FROM node:12

WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn install --production

# add app
COPY ./dist/ ./

# start app
CMD node apps/server/main.js
```

あとは `docker build .` でビルドし、 `docker run` コマンドで実行できることを確認する。

<img width="1284" alt="image.png (159.4 kB)" src="https://img.esa.io/uploads/production/attachments/14362/2020/04/29/50720/94340e50-27ee-4c6f-9dd8-96697ae808db.png">

これでCloud Runにデプロイ可能な状態となった。

## 課題

- Dockerfileで node_modulesをインストールするなら、最初からNest.jsのビルドでバンドルをしないようにしたほうがイメージサイズが減るのではないか
    - Nest.jsである必要もないので面倒そうならexpressに換装してもよさそう

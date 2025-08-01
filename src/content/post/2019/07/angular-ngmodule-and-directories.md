---
title: '中規模AngularアプリにおけるNgModule構成とディレクトリ構造'
slug: 'angular-ngmodule-and-directories'
icon: ''
created_time: '2019-07-11T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - '設計'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-NgModule-30d898e5e62d4967a93879622e2f9730'
features:
  katex: false
  mermaid: false
  tweet: false
---

## 要点

- `SharedModule` を卒業する
- 関心による分離を原則としてモジュール化する
  - 性質で分離しない
- Application と Library のモジュールを分ける

## 依存関係の原則

- Root と Feature は互いに依存しない

## プラクティス

### 関心による集約と分離

性質ではなく関心の領域によりモジュール化する。 `SharedModule` ではなく、その中の個別の機能群を個別にモジュール化する。

お手本は Angular Material の `MatButtonModule` や CDK の `LayoutModule` など。これにより、Lazy Loading によるコード分割の効果を高められる。

### アプリケーション内外の境界

アプリケーションの事情（アプリケーションドメイン）に依存する機能群は `app` 内に、依存しない機能群は `libs` 内に配置する。

`app/shared` ディレクトリに分離されたモジュールも、アプリケーションのコンテキストに依存しない形になったものは、 `libs` へ昇格できる。

Angular CLI であれば、 `libs` は `ng generate library` による multiple projects を利用するのも良い選択である。

### Feature Module のフラット化

ファイルツリーが深くなりすぎることを防ぐために、 Feature Module 内にさらに Feature Module を作ることを避ける。（これは中規模におけるプラクティスである）

Routing 管理を分散させすぎず、なるべくフラットに扱う。

### Injectable なサービスは原則として root に

`@Injectable({ providedIn: 'root' })` により、サービスはどこかで利用されることではじめてバンドルに含められる。

はじめは分散させるよりも root に集約するほうがよいだろう。

Feature Module 内に完全に閉じられるものは閉じてしまっても良い。

## ディレクトリ構造の例

```
src
├ app
│ ├ app.module.ts
│ ├ config
│ ├ domain
│ ├ store
│ ├ queries
│ ├ usecases
│ ├ components
│ │ ├ container
│ │ ├ pages
│ │ └ presenter
│ ├ services
│ │ ├ repositories
│ │ └ ...
│ ├ ...
│ ├ features
│ │ └ admin
│ │ 　 ├ admin-routing.module.ts
│ │ 　 ├ admin.module.ts
│ │ 　 ├ components
│ │ 　 ├ services
│ │ 　 └ ...
│ └ shared
│ 　 └ foo
│ 　 　 ├ index.ts
│ 　 　 └ foo.module.ts
└ libs
　 └ bar
　 　 ├ index.ts
　 　 └ bar.module.ts
```

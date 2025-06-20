---
title: 'Angular CLI v1.7からv6.0へのマイグレーションについて (for v6.0.0-rc.2)'
slug: 'migrate-angular-cli-from-1-7-to-6-0'
icon: ''
created_time: '2018-04-09T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-CLI-v1-7-v6-0-for-v6-0-0-rc-2-9dab9594a41d4af69f3536e029edd915'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular フレームワークの v6.0.0 リリースにあわせ、Angular CLI も v1.7 系から v6.0 へメジャーアップデートをおこなう予定です。 この記事では Angular CLI v1.7 系で作成した開発環境から v6.0 系の開発環境へマイグレーションする方法を解説します。

**この記事は安定版リリース前の RC バージョンを使用しています。**

## 前提

次のような開発環境を想定しています。

- グローバルに Angular CLI v1.7 系がインストールされている状態
  - `ng new` が可能な状態
- Angular CLI v1.7 系に依存した状態のプロジェクトが存在する状態
  - package.json の`@angular/cli` が v1.7 系、かつ `.angular-cli.json` ファイルが存在する状態

## 移行ステップ

### 1. プロジェクトローカルの Angular CLI のバージョンを更新する

グローバルではなく、プロジェクトローカルの Angular CLI を v6.0 系に更新します。 yarn であれば次のコマンドで更新します。

```
yarn add --dev @angular/cli@^6.0.0-rc.2
```

diff はこのようになります。

https://github.com/lacolaco/ngcli173migration/commit/b761e55f97ebd1ef1f8fe07cc7e1555c257ef6e9

この時点ではプロジェクトローカルの`ng`コマンドがアップデートされただけで、プロジェクトのマイグレーションは完了していません。 次のステップで、`ng build`などのコマンドが使用可能な状態にプロジェクトをマイグレーションします。

### 2. 各種設定ファイルをマイグレーションする

Angular CLI v1.7 から v6.0 へのアップデートのうち、最大の変更は`.angular-cli.json`ファイルから`angular.json`ファイルへの移行です。 これまで Angular CLI の各種設定を記述していた`.angular-cli.json`ファイルは、名前だけでなく内部の JSON 構造も互換性のない新しい`angular.json`に変わります。

とはいえ今までの設定をすべて書き直す必要はなく、Angular CLI v6 には古い形式の`.angular-cli.json`から`angular.json`ベースのプロジェクトに自動でマイグレーションしてくれる機能があります。 Angular CLI v1.7.3 のプロジェクトをマイグレーションするには、次のようにコマンドを実行します。

```
ng update @angular/cli --migrate-only --from=1.7.3
```

diff はこのようになります。

https://github.com/lacolaco/ngcli173migration/commit/9251788e5c59bbfa52b45b5b0f92278e8136a64b

このコマンドを一度実行すれば、以降は Angular CLI v6 による開発をおこなえるようになります。

### 注意

- RC.2 時点では、`ng update`後のパッケージインストールが npm になります。
  - グローバルの`packageManager`設定はマイグレーションされないため。

## TL;DR

- まずプロジェクトローカルの Angular CLI をアップデートする
  - `yarn add --dev @angular/cli@^6.0.0-rc.2`
- `ng update`コマンドでプロジェクトを v6 用にマイグレーションする
  - `ng update @angular/cli --migrate-only --from=1.7.3`

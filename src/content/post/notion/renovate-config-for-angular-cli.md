---
title: 'AngularプロジェクトのためのRenovate設定'
slug: 'renovate-config-for-angular-cli'
icon: ''
created_time: '2021-03-20T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
tags:
  - 'Angular'
  - 'Angular CLI'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Renovate-7bdac4fe30d94ae2a78081cbbb21b3c7'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では依存関係の更新を自動化する[Renovate](https://www.whitesourcesoftware.com/free-developer-tools/renovate)を使う上で、Angular CLI ベースのリポジトリに適した設定を紹介する。 またその設定を誰でも利用できるプリセットとして公開したので、その使い方も解説する。

## 自動化すべきでない依存パッケージ

Renovate は依存するライブラリなどの新しいバージョンが公開されると一定時間後にそのバージョンへ追従するプルリクエストを自動作成してくれる。 一般的なケースではこの機能はありがたいが、Angular CLI で管理されるリポジトリにおいては注意が必要である。なぜなら Renovate は `ng update` を実行しないからだ。

`ng update` コマンドは関連するパッケージグループをまとめてバージョンアップするだけでなく、バージョンアップ時に必要なソースコードのマイグレーションを自動実行する。たとえば `angular.json` から非推奨の設定項目を消してくれたり、メジャーバージョンアップで削除される API を代替 API に置換してくれたりする。継続的に Angular CLI プロジェクトをメンテナンスしていく上で `ng update` はとても重要な役割がある。

つまり、`ng update` による自動マイグレーションが必要な場合、Renovate でバージョンアップしてはならない。 これは `@angular/` から始まる Angular 公式のパッケージだけでなく、一部のサードパーティ製ライブラリにも当てはまる。

だがこれらのパッケージでもすべてのバージョンに自動マイグレーションが含まれるわけではない。 Angular 公式パッケージの場合、`ng update` による自動マイグレーションが含まれるのは基本的にマイナーバージョンアップ以上だ。 つまり、パッチバージョンアップのときは Renovate を使って更新して問題ない。

また、Angular はサポートする TypeScript バージョンがそれぞれ決められており、 `ng update` 以外のタイミングで TypeScript のマイナーバージョンは更新すべきではない （そもそも TypeScript は SemVer に則っていないためマイナーバージョンアップに後方互換性はない）。 そのため Angular 公式パッケージだけでなく TypeScript についても Renovate を使用できるのはパッチバージョンアップに限られる。

## Renovate 設定

Renovate からプルリクエストが来るたびにこのような経験則に従って取り扱うのは苦労するため、Renovate を使用するつもりのない条件をあらかじめ設定しておくことで運用を省力化できる。 上述のルールを Renovate 設定に記述すると次のようになる。

```json
{
  "packageRules": [
    {
      "groupName": "@angular/core package group (major or minor)",
      "matchSourceUrlPrefixes": ["https://github.com/angular/angular"],
      "matchUpdateTypes": ["major", "minor"],
      "enabled": false
    },
    {
      "groupName": "@angular/cli package group (major or minor)",
      "matchPackageNames": [
        "@angular/cli",
        "@angular-devkit/architect",
        "@angular-devkit/build-angular",
        "@angular-devkit/build-webpack",
        "@angular-devkit/core",
        "@angular-devkit/schematics"
      ],
      "matchUpdateTypes": ["major", "minor"],
      "enabled": false
    },
    {
      "groupName": "@angular/material package group (major or minor)",
      "matchPackageNames": [
        "@angular/material",
        "@angular/cdk",
        "@angular/material-moment-adapter"
      ],
      "matchUpdateTypes": ["major", "minor"],
      "enabled": false
    },
    {
      "groupName": "typescript (major or minor)",
      "matchPackageNames": ["typescript"],
      "matchUpdateTypes": ["major", "minor"],
      "enabled": false
    }
  ]
}
```

この設定により、Angular 公式パッケージと TypeScript についてはパッチバージョンアップだけが Renovate の管理下に置かれる。 もちろんこれは開発者自身が Angular のバージョンアップに追従していくことを求めるが、Angular のリリースはタイムベースなので定期的なルーチンとして毎月 `ng update` していれば問題ないはずだ。

## Renovate 共有可能プリセット

Renovate は再利用可能な設定をプリセットとして公開して共有する機能がある。

[Shareable Config Presets | Renovate Docs](https://docs.renovatebot.com/config-presets/#preset-hosting)

この機能で参照できるように Angular CLI プロジェクト用のプリセットを公開したので、ぜひ使ってみてほしい。

https://github.com/lacolaco/renovate-config

任意のリポジトリの `renovate.json` で次のようにプリセットを指定するだけで設定を適用できる。

```json
{
  "extends": ["config:base", "github>lacolaco/renovate-config:ng-update"]
}
```

もちろんプリセットの中に適用したくない設定があれば、 `renovate.json` で上書きすることもできる。

設定の問題点や改善できる点を見つけた方はぜひ GitHub の Issue か Twitter などで教えてほしい。

## おまけ: `@types` の自動マージ

Angular とは関係ないが、日頃 `@types`パッケージのバージョンアップを自動マージする設定を書くことが多い。 型定義ファイルだけ更新されても実行には影響しないため、コンパイルに問題がないことを CI で確認できれば動作確認などは必要なく、そのままマージできると判断している。 さすがにメジャーバージョンが変わったことは開発者の目に留まるべきだと思うため、自動マージはマイナーバージョンアップまでに限っている。

この設定を書くと次のようになる。

```json
{
  "packageRules": [
    {
      "groupName": "@types packages (minor or patch)",
      "matchPackagePatterns": ["^@types/"],
      "matchUpdateTypes": ["minor", "patch"],
      "automerge": true
    }
  ]
}
```

この設定も再利用できるように共有可能プリセットとして公開したため、便利だと思ったら使ってみてほしい。 `ng-update`と同じく次のように参照して使用できる。

```json
{
  "extends": ["config:base", "github>lacolaco/renovate-config:automerge-types"]
}
```

ただし、このプリセットを使う際には必ずリポジトリは CI を用意し、TypeScript のコンパイルをチェックしていることを前提としてほしい。

## まとめ

Angular CLI ベースのリポジトリで一般的に適用できる Renovate 設定を共有可能プリセットとして公開した。 プリセットに含めたのは Angular 公式パッケージに関連するものに限っているが、他に`ng update`に対応しているサードパーティライブラリを使っていればそれにも同じ設定を適用することをおすすめする。

もし Angular プロジェクトで Renovate の運用に困っている人がいたら参考にしてみてほしい。


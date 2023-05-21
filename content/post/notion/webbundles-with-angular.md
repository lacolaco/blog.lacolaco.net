---
title: 'AngularでWeb Bundlesを試す'
date: '2019-12-25T00:00:00.000Z'
tags:
  - 'tech'
  - 'angular'
  - 'webpackaging'
draft: false
source: 'https://www.notion.so/Angular-Web-Bundles-71bd2be8bc254bf692ae57848af085ef'
---

[Angular アドベントカレンダー #2](https://qiita.com/advent-calendar/2019/angular-2)の 24 日目代打記事です。

[Web Bundles](https://web.dev/web-bundles/)とは、現在標準化が検討されている新しい Web の仕様です。Web ページとそれに紐づくサブリソースをひとつのバンドルとしてパッケージ化することができます。

この記事では Web Bundles を手元の Angular アプリケーションで試してみたい人向けの手順を紹介します。

## CLI Builder のインストール

[lacolaco/ngx-web-bundles](https://github.com/lacolaco/ngx-web-bundles)というパッケージで、Angular CLI 向けの Builder を作っています。 次のコマンドを実行するだけで、Web Bundle をビルドする準備が整います。

```plain text
$ ng add @lacolaco/ngx-web-bundle
```

インストールできたら、 任意のプロジェクトで`gen-bundle`コマンドを実行します。

```plain text
$ ng run <project name>:gen-bundle
```

ビルドが終わると`index.html`が出力される dist ディレクトリと同じ階層に `out.wbn` というファイルが生成されているはずです。このファイルを Google Chrome の Canary 版で Web Bundles を有効にしてから開くと、バンドルを展開できるはずです。

## How it works

ngx-web-bundle がやっているのは２つのことです。

1. `ng add` されたときに `angular.json` を更新し、 `gen-bundle`コマンドを定義する
1. `gen-bundle`コマンドが実行されたときに処理する

### ng-add 時の動き

ng-add 時に動くのは次の`ngAdd`関数です。

{{< embed "https://github.com/lacolaco/ngx-web-bundles/blob/master/schematics/ng-add/index.ts#L15" >}}

やっていることは次の 2 つです。

1. 対象とするプロジェクトを特定する
1. プロジェクトの `architects` に `gen-bundle`を追加する

### `gen-bundle`時の動き

`gen-bundle`コマンドで動くのは次の`build`関数です。

{{< embed "https://github.com/lacolaco/ngx-web-bundles/blob/master/index.ts#L51" >}}

やっていることは次の 3 つです。

1. `executeBrowserBuilder` を使って、アプリケーションのビルドをおこなう（`ng build`と同じ処理を実行する）
1. ビルド後の生成物を `wbn` パッケージを使ってバンドル化する
1. アプリケーションの生成物を同じ場所にバンドルを出力する

バンドル化の処理は次の関数に記述されています。特別に配慮が必要なのは index.html だけで、それ以外はファイルごとに同じ処理をしています。

{{< embed "https://github.com/lacolaco/ngx-web-bundles/blob/master/index.ts#L24" >}}

ひとつひとつのやっていることはシンプルです。それらを組み合わせてルールに従って配置すれば簡単に Angular CLI 経由で動かせるスクリプトを作成できます。

## Takeaways

- Angular で Web Bundles を試すなら `@lacolaco/ngx-web-bundle` をどうぞ
- 自作のスクリプトを`ng add`や`ng run`に対応させるのは意外に簡単です
  - デバッグはちょっと面倒です
- Web Bundles については web.dev/web-bundles/ を参照してください

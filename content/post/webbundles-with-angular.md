---
title: "AngularでWeb Bundlesを試す"
date: 2019-12-25T04:48:53Z
slug: "webbundles-with-angular"
tags: ["angular", "webpackaging", "web"]
---

[Angularアドベントカレンダー #2](https://qiita.com/advent-calendar/2019/angular-2)の24日目代打記事です。


[Web Bundles](https://web.dev/web-bundles/)とは、現在標準化が検討されている新しいWebの仕様です。Webページとそれに紐づくサブリソースをひとつのバンドルとしてパッケージ化することができます。

この記事ではWeb Bundlesを手元のAngularアプリケーションで試してみたい人向けの手順を紹介します。


## CLI Builderのインストール

[lacolaco/ngx\-web\-bundles](https://github.com/lacolaco/ngx-web-bundles)というパッケージで、Angular CLI向けのBuilderを作っています。
次のコマンドを実行するだけで、Web Bundleをビルドする準備が整います。

```
$ ng add @lacolaco/ngx-web-bundle
```

インストールできたら、 任意のプロジェクトで`gen-bundle`コマンドを実行します。

```
$ ng run <project name>:gen-bundle
```


ビルドが終わると`index.html`が出力されるdistディレクトリと同じ階層に `out.wbn` というファイルが生成されているはずです。このファイルをGoogle ChromeのCanary版で Web Bundlesを有効にしてから開くと、バンドルを展開できるはずです。


## How it works

ngx-web-bundleがやっているのは２つのことです。

1. `ng add` されたときに `angular.json` を更新し、 `gen-bundle`コマンドを定義する
2. `gen-bundle`コマンドが実行されたときに処理する

### ng-add時の動き

ng-add時に動くのは次の`ngAdd`関数です。

https://github.com/lacolaco/ngx-web-bundles/blob/master/schematics/ng-add/index.ts#L15

やっていることは次の2つです。

1. 対象とするプロジェクトを特定する
2. プロジェクトの `architects` に `gen-bundle`を追加する

### `gen-bundle`時の動き

`gen-bundle`コマンドで動くのは次の`build`関数です。

https://github.com/lacolaco/ngx-web-bundles/blob/master/index.ts#L51

やっていることは次の3つです。

1. `executeBrowserBuilder` を使って、アプリケーションのビルドをおこなう（`ng build`と同じ処理を実行する）
2. ビルド後の生成物を `wbn` パッケージを使ってバンドル化する
3. アプリケーションの生成物を同じ場所にバンドルを出力する

バンドル化の処理は次の関数に記述されています。特別に配慮が必要なのはindex.htmlだけで、それ以外はファイルごとに同じ処理をしています。

https://github.com/lacolaco/ngx-web-bundles/blob/master/index.ts#L24

ひとつひとつのやっていることはシンプルです。それらを組み合わせてルールに従って配置すれば簡単にAngular CLI経由で動かせるスクリプトを作成できます。

## Takeaways

- AngularでWeb Bundlesを試すなら `@lacolaco/ngx-web-bundle` をどうぞ
- 自作のスクリプトを`ng add`や`ng run`に対応させるのは意外に簡単です
  - デバッグはちょっと面倒です
- Web Bundlesについては web.dev/web-bundles/ を参照してください


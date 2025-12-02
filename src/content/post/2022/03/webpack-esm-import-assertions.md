---
title: 'webpack と ES Module Import Assertions についての調査'
slug: 'webpack-esm-import-assertions'
icon: ''
created_time: '2022-03-09T00:18:00.000Z'
last_edited_time: '2023-12-30T10:06:00.000Z'
tags:
  - 'webpack'
  - 'ESModule'
  - 'Import Assertions'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/webpack-ES-Module-Import-Assertions-2d15afb885274cc48b6930a395588112'
features:
  katex: false
  mermaid: false
  tweet: false
---

ES Moduleの Import Assertions が各環境で使えるようになるのも遠くない。

https://v8.dev/features/import-assertions

https://sosukesuzuki.dev/posts/import-assertions/

しかし現実のユースケースではまだまだモジュールバンドラーを使ってデプロイ前にモジュール解決を済ませることが多いだろうから、Import Assertionsを直接ブラウザ上で使用することは少ないだろう。

というわけでソースコードで Import Assertionsを使ったときに、webpack によるモジュール解決がどのように振る舞うかを調べてみた。なぜ調べる必要があったかというと、ドキュメンテーションが（そこそこ探した限りでは）見つからず、ブログなどのアンオフィシャルなものすら見当たらなかったからだ。だが、GitHubの履歴を見ると間違いなくImport Assertionsに対応する実装は加えられていたので、実態がどうなっているかは実際に動かして試すこととなった。

https://github.com/webpack/webpack/pull/12278

## アサーションなし（ファイル拡張子による判別）

`data.json` ファイルを拡張子付きのパスでインポートする。webpackはJSONのインポートをビルトインでサポートしており、これはそのまま自動的にJSONとしてパースされる。

<figure>
  <img src="/images/webpack-esm-import-assertions/Untitled.edeffcb58f5a8e39.png" alt="data.jsonのインポート（アサーションなし）">
  <figcaption>data.jsonのインポート（アサーションなし）</figcaption>
</figure>

インポートのパスで拡張子を省略していても、デフォルトのwebpack設定が `.json` の省略を許可しているので自動的に探索され、ファイルの拡張子からJSONであることを判別する。

<figure>
  <img src="/images/webpack-esm-import-assertions/Untitled.fdc307c744822bd0.png" alt="data.jsonのインポート（アサーションなし、拡張子省略）">
  <figcaption>data.jsonのインポート（アサーションなし、拡張子省略）</figcaption>
</figure>

つまり、ファイルの拡張子を削除するとwebpackはそのファイルがJSONであることがわからなくなり、モジュールのパースに失敗する。次の例では `./data` ファイルをインポートしようとしてパースできずにエラーになっている。

<figure>
  <img src="/images/webpack-esm-import-assertions/Untitled.e3560f34fbf487b1.png" alt="dataのインポート（アサーションなし、拡張子なし）は失敗する">
  <figcaption>dataのインポート（アサーションなし、拡張子なし）は失敗する</figcaption>
</figure>

## アサーションあり ( JSON )

ここからは Import Assertions によるファイル形式のアサーションを試みる。 `assert { type: 'json' }` を付与し、先ほどの拡張子がないJSONファイルのインポートをすると、JSONであることを判別し、問題なくパースできていた。（エディタ上の赤線は無視してほしい）

<figure>
  <img src="/images/webpack-esm-import-assertions/Untitled.23128ddc007a774f.png" alt="dataのインポート（JSONアサーションあり）は成功する">
  <figcaption>dataのインポート（JSONアサーションあり）は成功する</figcaption>
</figure>

## その他のファイル形式のアサーション

webpackといえば Loader によってさまざまな形式のファイルをモジュール解決できるのが魅力だ。webpackの Import Assertions はJSON以外にも対応しているのか一応試してみた。

JSONの拡張であるJSON5のファイル `data.json5` をパースできるか試してみた。事前に `json5-loader` をインストールした上で、特にwebpack設定には手を入れずに `type: 'json5'` を指定してみたが、これではモジュール解決できなかった。エラーを見るに、JSONとしてパースしようとして失敗したようだ。なぜJSONだと解釈したのだろうか？

<figure>
  <img src="/images/webpack-esm-import-assertions/Untitled.7cb28c122166c863.png" alt="data.json5のパース（アサーションあり）は失敗">
  <figcaption>data.json5のパース（アサーションあり）は失敗</figcaption>
</figure>

次に、 `styles.postcss` というファイルを用意し、さらにwebpack設定に `.css` ファイルについてのルールを追加した（一般的な `style-loader` と `css-loader` を通すもの）。そのうえで、 `styles.postcss` ファイルを `type: 'css'` だとアサーションしてインポートするとどうなるかを試してみた。

結果は以下のように、 `.postcss` ファイルに対応する Loader がないためにパースできずエラーとなった。アサーションによって Loader を切り替えるようなことは（少なくとも今は）できないようだ。

<figure>
  <img src="/images/webpack-esm-import-assertions/Untitled.006e7ccff310d542.png" alt="cssであることをアサーションで教えることはできなかった">
  <figcaption>cssであることをアサーションで教えることはできなかった</figcaption>
</figure>

## 現状の結論

webpackのImport Assertions対応は、現状では JSON 形式のアサーションだけが可能なようだ。そもそも拡張子さえあればもともとJSONのインポートはビルトインサポートされていることから、この対応で何か新しい機能が増えているわけではない。

開発者はこれまでどおりアサーションなしにインポートしてもよいが、それはwebpackが気を利かせてくれているだけだ。そしてwebpack以外でもJSONを読み込める標準化された記法に切り替えるという選択肢も用意されている、ということだろう。

今回の調査は Stackblitz上の Node.js 環境で行った。再現したい場合はこちらを参照されたし。

https://stackblitz.com/edit/node-xzb5hq?file=index.js


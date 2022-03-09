---
title: 'webpack と ES Module Import Assertions についての調査'
date: '2022-03-09T00:18:00.000Z'
updated_at: '2022-03-09T01:28:00.000Z'
tags:
  - 'webpack'
  - 'ESModule'
  - 'Import Assertions'
  - 'JavaScript'
draft: false
source: 'https://www.notion.so/webpack-ES-Module-Import-Assertions-2d15afb885274cc48b6930a395588112'
---

ES Module の Import Assertions が各環境で使えるようになるのも遠くない。

{{< embed "https://v8.dev/features/import-assertions" >}}

{{< embed "https://sosukesuzuki.dev/posts/import-assertions/" >}}

しかし現実のユースケースではまだまだモジュールバンドラーを使ってデプロイ前にモジュール解決を済ませることが多いだろうから、Import Assertions を直接ブラウザ上で使用することは少ないだろう。

というわけでソースコードで Import Assertions を使ったときに、webpack によるモジュール解決がどのように振る舞うかを調べてみた。なぜ調べる必要があったかというと、ドキュメンテーションが（そこそこ探した限りでは）見つからず、ブログなどのアンオフィシャルなものすら見当たらなかったからだ。だが、GitHub の履歴を見ると間違いなく Import Assertions に対応する実装は加えられていたので、実態がどうなっているかは実際に動かして試すこととなった。

{{< embed "https://github.com/webpack/webpack/pull/12278" >}}

## アサーションなし（ファイル拡張子による判別）

`data.json` ファイルを拡張子付きのパスでインポートする。webpack は JSON のインポートをビルトインでサポートしており、これはそのまま自動的に JSON としてパースされる。

{{< figure src="/img/webpack-esm-import-assertions/bdce5bc6-e660-44c0-9d71-d070561965ff/Untitled.png" caption="data.jsonのインポート（アサーションなし）" >}}

インポートのパスで拡張子を省略していても、デフォルトの webpack 設定が `.json` の省略を許可しているので自動的に探索され、ファイルの拡張子から JSON であることを判別する。

{{< figure src="/img/webpack-esm-import-assertions/43d6e83e-451d-43a2-bceb-d8bbcac815a5/Untitled.png" caption="data.jsonのインポート（アサーションなし、拡張子省略）" >}}

つまり、ファイルの拡張子を削除すると webpack はそのファイルが JSON であることがわからなくなり、モジュールのパースに失敗する。次の例では `./data` ファイルをインポートしようとしてパースできずにエラーになっている。

{{< figure src="/img/webpack-esm-import-assertions/2d106676-7b21-44d1-b08f-00d2ee1d1b62/Untitled.png" caption="dataのインポート（アサーションなし、拡張子なし）は失敗する" >}}

## アサーションあり ( JSON )

ここからは Import Assertions によるファイル形式のアサーションを試みる。 `assert { type: 'json' }` を付与し、先ほどの拡張子がない JSON ファイルのインポートをすると、JSON であることを判別し、問題なくパースできていた。（エディタ上の赤線は無視してほしい）

{{< figure src="/img/webpack-esm-import-assertions/f36b6050-c102-422f-b4bf-238b814bf26a/Untitled.png" caption="dataのインポート（JSONアサーションあり）は成功する" >}}

## その他のファイル形式のアサーション

webpack といえば Loader によってさまざまな形式のファイルをモジュール解決できるのが魅力だ。webpack の Import Assertions は JSON 以外にも対応しているのか一応試してみた。

JSON の拡張である JSON5 のファイル `data.json5` をパスできるか試してみた。事前に `json5-loader` をインストールした上で、特に webpack 設定には手を入れずに `type: 'json5'` を指定してみたが、これではモジュール解決できなかった。エラーを見るに、JSON としてパースしようとして失敗したようだ。なぜ JSON だと解釈したのだろうか？

{{< figure src="/img/webpack-esm-import-assertions/11e6c8bd-1eb3-4717-aa28-3b98ca7089ef/Untitled.png" caption="data.json5のパース（アサーションあり）は失敗" >}}

次に、 `styles.postcss` というファイルを用意し、さらに webpack 設定に `.css` ファイルについてのルールを追加した（一般的な `style-loader` と `css-loader` を通すもの）。そのうえで、 `styles.postcss` ファイルを `type: 'css'` だとアサーションしてインポートするとどうなるかを試してみた。

結果は以下のように、 `.postcss` ファイルに対応する Loader がないためにパースできずエラーとなった。アサーションによって Loader を切り替えるようなことは（少なくとも今は）できないようだ。

{{< figure src="/img/webpack-esm-import-assertions/5248adea-7c1c-474f-9385-53a27fc9c807/Untitled.png" caption="cssであることをアサーションで教えることはできなかった" >}}

## 現状の結論

webpack の Import Assertions 対応は、現状では JSON 形式のアサーションだけが可能なようだ。そもそも拡張子さえあればもともと JSON のインポートはビルトインサポートされていることから、この対応はあくまで構文としてのパースできるようにするものである。

開発者はこれまでどおりアサーションなしにインポートしてもよいが、それは webpack が気を利かせてくれているだけだ。そして webpack 以外でも JSON を読み込める標準化された記法に切り替えるという選択肢も用意されている、ということだろう。

今回の調査は Stackblitz 上の Node.js 環境で行った。再現したい場合はこちらを参照されたし。

{{< embed "https://stackblitz.com/edit/node-xzb5hq?file=index.js" >}}

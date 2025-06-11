---
title: 'opentelemetry-js レポジトリの歩き方'
slug: 'opentelemetry-js-repository-walkthrough'
icon: ''
created_time: '2024-04-14T00:37:00.000Z'
last_edited_time: '2024-04-14T03:45:00.000Z'
category: 'Tech'
tags:
  - 'OpenTelemetry'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/opentelemetry-js-1a5a4c7ea7844aca8cf5ef394fe0564c'
features:
  katex: false
  mermaid: false
  tweet: false
---

去年からOpenTelemetry関連のことを調べたり触ったりすることが多くなった。しかしOpenTelemetryの公式JavaScript SDKの使い方は、お世辞にも誰にとっても簡単だとは言いにくい。ドキュメントも豊富ではないので、だいたいはソースコードを読んで試行錯誤しながら探ることになる。この記事ではだいたいどういう用途に使うにせよ必要になるレポジトリの基本的な歩き方をまとめておく。

まず混乱するのはopentelemetry-jsの関連パッケージの数の多さである。実装を追うにあたってはどのパッケージがどのように配置されているのか、パッケージごとの役割と命名規則を知っておかないと話が始まらない。

https://github.com/open-telemetry/opentelemetry-js

## api: 計装用API

[https://github.com/open-telemetry/opentelemetry-js/tree/main/api](https://github.com/open-telemetry/opentelemetry-js/tree/main/api)

`api` ディレクトリは `@opentelemetry/api` パッケージに対応している。このパッケージはアプリケーション中での計装に使われる `trace` や `context` 、`propagation`といったAPIを提供する。

これらのAPIは後述の`TraceProvider`がセットアップされていることを前提とする。ソースコードを読むうえでも結局このパッケージだけでは完結せず他のパッケージを読みに行くことになる。

## packages: 安定パッケージ群

[https://github.com/open-telemetry/opentelemetry-js/tree/main/packages](https://github.com/open-telemetry/opentelemetry-js/tree/main/packages)

`packages` ディレクトリにはSDKを構成する主要なパッケージ群が入っている。主要というか、このレポジトリの区分で言えば安定APIとして使われることを想定したパッケージ群である。

このパッケージ群はアプリケーションでの計装に直接使われるものではなく、主に `TraceProvider` をセットアップするためのAPIを提供している。（`semantic-conventions`だけはやや例外か）

このディレクトリの中の命名規則は単純である。先頭の `opentelemetry-` は共通のものとして、大きく次の分類ができる。

- **`opentelemetry-context-*`**
  - `TraceProvider` に登録する `ContextManager` として使える個別の実装を提供する
- **`opentelemetry-exporter-*`**
  - `SpanExporter` として使える個別の実装を提供する。あまり数は多くない
  - `new BatchSpanProcessor(exporter)` のように `SpanProcessor` に渡すことになる
- **`opentelemetry-propagator-*`**
  - `TraceProvider` に登録する `TextMapPropagator` として使える個別の実装を提供する
- **`opentelemetry-sdk-trace-*`\*\*** \*\*
  - 上述のパッケージなどが組み合わされたBattery-includedな `TraceProvider` 実装を提供する
  - Node.jsやBrowserのようなプラットフォームごとのSDKになっている
- その他
  - core, resources, semantic-conventions など、他のパッケージから依存される共通部分が該当する
  - TypeScriptの型情報や定数などはこのあたりから提供される

## experimental/packages: 実験的パッケージ群

[https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental](https://github.com/open-telemetry/opentelemetry-js/tree/main/experimental)

このディレクトリには（おそらく）まだ安定しているとは言えない新しいパッケージ群が含まれている。頻繁に破壊的変更が入ることを想定して使うべきだが、けっこう便利なものが多く使わざるを得ない場面がある。数が多いので個別には解説できないが、ここでもパッケージの命名規則でだいたいの役割を掴むことができる。

- **`api-logs`**
  - ログ収集のための計装API。トレースの計装APIは安定版になっているがログはまだ実験的なのでここにある。
  - 同様に `api-events` というものも開発中
- **`exporter-*`**
  - テレメトリのExporter実装を提供している。ログのExporterもあるが、トレースのものもある。それぞれ各OTLPのプロトコルに対応してパッケージが分けられている
  - `opentelemetry-exporter-metrics-*` もあるが、命名規則が違う理由はわからない。
  - 基底パッケージとして `otlp-*-exporter-base` というものもあり、このあたりは自分がほしいAPIがどこにあるかひとつひとつ探して見つけるしかない
- **`opentelemetry-instrumentation-*`**
  - 自動計装を提供するパッケージ群
  - 自動計装のパッチを当てる対象ごとにパッケージが分けられている

このあたりを抑えておけばひととおり欲しいAPIは見つけられるだろう。実験的パッケージ群は命名規則も一貫性がない気がしており、名前もいつ変わるかわからないと思って構えておくのがいいと思われる。

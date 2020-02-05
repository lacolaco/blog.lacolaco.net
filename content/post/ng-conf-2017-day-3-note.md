---
date: "2017-04-07T20:15:22-06:00"
title: "ng-conf 2017 3日目 Keynoteメモ"
tags: [ng-conf, Event]
---

アメリカ・ソルトレイクシティで4/5から開催中のng-confに参加しています。
3日目のKeynoteの内容を現地からかいつまんでまとめます。

<!--more-->

## Keynote

- スピーカー
  - Brad Green
  - Rob Wormald

### GoogleにおけるAngularについて

- GoogleはAngularの上に成り立っている
  - 200以上のAngularアプリケーションが動いている
- 2017年の目標
  - JavaScript (Closure)からTypeScriptへの自動変換ツールの開発
  - Material 1とMaterial 2の共存
  - Google Angular Courses
    - GoogleのAngularエンジニアによるトレーニング内容の公開
    - これまでに59人のトレーナー、19のオフィスで3000人以上のGooglerが受講した
- AngularJSからAngularに更新中のパブリックなアプリケーション
  - Cloud Platform (コンソール)
  - Google Analytics (管理画面)
  - Firebase (コンソール)
  - Google Express
- なぜAngularをオープンソースにするのか
  - 開発費の問題
  - エコシステム: ツールやIDEの拡張など
  - トレーニング: たくさんの教材が公開される。Googleでもegghead.ioを使っている
  - 雇用: オープンソースにすることでAngularのエンジニアを採用しやすくなる
  - 品質: Google外のユースケースで使われることで品質が高まる
- 2017年2月のGoogle
  - Angularは使われ始めたが、TypeScriptとAngular CLIは使われていなかった
  - 何故か？
  - Googleの公式採用言語
    - C/C++
    - Java
    - JavaScript (Closure)
    - Python
    - Go
  - Googleでは新しい言語の採用プロセスがある
    - 約2年ほどかかる
  - ついにTypeScriptが承認された！
- 2017年4月からGoogle社内でTypeScriptが使えるようになった
  - CLIはまだ採用されていない
- Google社内のツール事情
  - Bazel + Closure
  - Bazel
    - 高速、スケーラブル、柔軟、安定、リビルド性
    - http://bazel.build
- Angular with Bazel and Closure (**ABC**)
  - ソースコードはTypeScript
  - Bazelでビルドし、Closureで最適化する
  - まずはAngular Coreで実験し、Angular Materialに採用されたら外部のアーリーアダプター向けに展開していく

### Angularプラットフォームについて

- 愛されるアプリケーションを作るためにどうすればいいか
  - モバイルでは初期レンダリングが遅いと離脱される
  - インタラクティブなアプリケーションでありながらモバイルで高速に起動する必要がある
- @angular/platform-server
  - 旧Angular Universal
  - App Shellによりインタラクティブで高速なアプリケーションを作る
- App ShellはService Workerと相性がよい
  - キャッシュによるオフライン化
  - **Angular Service Worker**でオフラインキャッシュを簡単に実現する
- Angular Coreからは特定のWebアプリケーション・サーバー向けにライブラリを出さない
  - 単純にNode.jsによってHTMLをレンダリングするAPIだけを提供する
  - Expressのengineなどはコミュニティ主導で開発してほしい
- AMP + PWA
  - AMPに対応したページはGoogle検索で有利な表示をされる
  - PWAと連携させるフローを考案中
    - AMPページを高速に表示し、バックグラウンドでService Workerをインストールする
    - PWAへ誘導することでApp Shellのキャッシュなどが済んだ状態で高速にアプリケーションを起動できる

----

1日目同様に新発表などはほとんどありませんでした。キーワードは**TypeScript**と**ABC**、**platform-server**でしょうか。
GoogleでTypeScriptが公式に採用されたのは大きなニュースかもしれません。これまで以上にAngularとTypeScriptの関係が親密になりそうな予感がします。
動画はすでに [Youtube](https://www.youtube.com/watch?v=Nj9_p4qvm5U)に公開されているので、もっと細かくチェックしたい方は参照してください。

それではこれから日本に帰ります。さよならソルトレイクシティ！
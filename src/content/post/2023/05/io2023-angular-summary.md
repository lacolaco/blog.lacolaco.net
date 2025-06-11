---
title: 'Google I/O 2023 Angular関連セッションまとめ'
slug: 'io2023-angular-summary'
icon: ''
created_time: '2023-05-15T12:09:00.000Z'
last_edited_time: '2023-12-30T10:04:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Firebase'
  - 'Signals'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Google-I-O-2023-Angular-09878dcc7052432cad3f89c3b30ced25'
features:
  katex: false
  mermaid: false
  tweet: false
---

Google I/O 2023 の中で Angular について触れられたセッションを紹介する。

## Developer keynote

まずは Developer keynote から。今年の I/O は珍しく Developer keynote にも Angular の名前が数回登場しており、こんな風に扱われるのは実は初めてではないかと思う。

https://www.youtube.com/watch?v=r8T0SnwHRNI

Flutter のアップデートに関するところでは、Flutter Web の新しい機能のデモにちゃっかり登場した。 Flutter Web で作られたウィジェットが Angular アプリケーションに埋め込まれているというものだ。

![image](/images/io2023-angular-summary/Developer_keynote_%28Google_I_O_23%29_36-38_screenshot.png)

このデモについては Flutter の個別セッション動画の方でもう少し詳しく触れられているので興味があれば見てみるとよい。特にAngularの開発者に役立つ情報はないが。

https://youtu.be/PY42FysQTgw?t=211

Developer keynote の Webパート では、Chrome DevTools のデバッグ機能のアップデートを紹介する題材としてAngularアプリケーションの例が使われていた。同じ機能を紹介する個別セッション動画の方では React のコードになっていたのだが、keynote ではあえて Angular を選んでくれたのだろうか。

<figure>
  <img src="/images/io2023-angular-summary/Developer_keynote_%28Google_I_O_23%29_37-2_screenshot.png" alt="エラースタックトレースの改善">
  <figcaption>エラースタックトレースの改善</figcaption>
</figure>

<figure>
  <img src="/images/io2023-angular-summary/Developer_keynote_%28Google_I_O_23%29_37-4_screenshot.png" alt="ソースマップとデバッグ機能の改善">
  <figcaption>ソースマップとデバッグ機能の改善</figcaption>
</figure>

また、パフォーマンスに関するセクションでは先日リリースされた Angular v16 のパフォーマンス改善を紹介してくれた。Google I/O の keynote でこんな大々的にプロモーションされるのはかなりレアだ。

<figure>
  <img src="/images/io2023-angular-summary/Developer_keynote_%28Google_I_O_23%29_38-38_screenshot.png" alt="Angular v16 のパフォーマンス改善">
  <figcaption>Angular v16 のパフォーマンス改善</figcaption>
</figure>

## Angular sessions

今年の Angular 個別セッションは3つだった。YouTubeの再生リストは [goo.gle/IO23_angular](https://goo.gle/IO23_angular) にまとめてある。

### New in Angular

最初の方は Angular にあまり詳しくない人向けにAngular そのものの紹介から始まるが、途中からは v15 で入った Standalone Components、v16で入った Signals や SSRのHydrationなど最新のアップデート内容もわかりやすく紹介しているので Angular を知っている人もぜひ見てほしい。

https://www.youtube.com/watch?v=uqWUv0dpib0

<figure>
  <img src="/images/io2023-angular-summary/Whats_new_in_Angular_15-38_screenshot.png" alt="Angular の最近のアップデートの3本柱 Reactivity, SSR改善, QoL改善">
  <figcaption>Angular の最近のアップデートの3本柱 Reactivity, SSR改善, QoL改善</figcaption>
</figure>

### Rethinking reactivity with Angular Signals

Angular v16 で開発者プレビューAPIとして公開された Signals API にフォーカスしたセッション。Signals のベースになっている Reactivity という考え方から教えてくれる。まだ Signals を使う予定がなくても、今後はかならず避けて通れない道なので、ぜひキャッチアップしておこう。また、チームメンバーに Signals をレクチャーしなければならないときにも参考資料にできるはずだ。

https://www.youtube.com/watch?v=EIF0g9LDHcQ

<figure>
  <img src="/images/io2023-angular-summary/Rethinking_reactivity_with_Angular_Signals_9-33_screenshot.png" alt="v16移行のSignalsの計画について">
  <figcaption>v16移行のSignalsの計画について</figcaption>
</figure>

<figure>
  <img src="/images/io2023-angular-summary/Rethinking_reactivity_with_Angular_Signals_9-49_screenshot.png" alt="Signals をひとことで。">
  <figcaption>Signals をひとことで。</figcaption>
</figure>

### Getting started with Angular Signals

この動画は今年新しく作成されたコードラボを紹介するワークショップセッションになっている。これだけ見て学ぶというよりは、コードラボを進めながら見るのがいいだろう。

https://www.youtube.com/watch?v=EEzDLpIbW9w

コードラボはすでに日本語翻訳もあるため、ぜひ Signals を学ぶのに使ってほしい。動画を見てもわかると思うがけっこう面白い本格的な内容になっている。

https://codelabs.developers.google.com/angular-signals?hl=ja#0

## Firebase 関連

毎年恒例で、Firebase関連のセッションを見ているといくつか AngularFire 関連のアップデートについて語られることがある。今年は2つのセッションで Angular が登場したのでざっくり紹介する。

### **How to run dynamic web apps on Firebase**

[https://youtu.be/MhkDpZA_Ciw?t=499](https://youtu.be/MhkDpZA_Ciw?t=499)

Firebase HostingとFunctionsについてのアップデートの中で、Angular Universal のサポートについて言及があった。ライブラリのメンテナンスには今後も投資してくれそうだ。

<figure>
  <img src="/images/io2023-angular-summary/How_to_run_dynamic_web_apps_on_Firebase_8-22_screenshot.png" alt="Angular Universal への投資を今後も続けていく">
  <figcaption>Angular Universal への投資を今後も続けていく</figcaption>
</figure>

### **Building with Firebase webframeworks**

[https://www.youtube.com/watch?v=YUwJqZLLjQ0](https://www.youtube.com/watch?v=YUwJqZLLjQ0)

こちらは AngularFire を使って実践的なアプリケーションを開発するコードラボのワークショップセッション。Auth, Storage, Firestore, Functions, Hosting を組み合わせた内容になっているのでなかなかやりごたえがありそうだ。ローカルエミュレータを使った開発も学べるようになっている。

https://firebase.google.com/codelabs/firebase-web-io23?hl=ja#0

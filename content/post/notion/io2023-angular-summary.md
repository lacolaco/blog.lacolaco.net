---
title: 'Google I/O 2023 Angular関連セッションまとめ'
date: '2023-05-15T12:09:00.000Z'
tags:
  - 'tech'
  - 'angular'
  - 'Firebase'
  - 'Signals'
draft: false
source: 'https://www.notion.so/Google-I-O-2023-Angular-09878dcc7052432cad3f89c3b30ced25'
---

Google I/O 2023 の中で Angular について触れられたセッションを紹介する。

## Developer keynote

まずは Developer keynote から。今年の I/O は珍しく Developer keynote にも Angular の名前が数回登場しており、こんな風に扱われるのは実は初めてではないかと思う。

{{< youtube "r8T0SnwHRNI" >}}

Flutter のアップデートに関するところでは、Flutter Web の新しい機能のデモにちゃっかり登場した。 Flutter Web で作られたウィジェットが Angular アプリケーションに埋め込まれているというものだ。

{{< figure src="/img/io2023-angular-summary/c1850246-5e0a-4d66-a5ba-7b3fa070931a/Developer_keynote_(Google_I_O_23)_36-38_screenshot.png" caption="" >}}

このデモについては Flutter の個別セッション動画の方でもう少し詳しく触れられているので興味があれば見てみるとよい。特に Angular の開発者に役立つ情報はないが。

{{< embed "https://youtu.be/PY42FysQTgw?t=211" >}}

Developer keynote の Web パート では、Chrome DevTools のデバッグ機能のアップデートを紹介する題材として Angular アプリケーションの例が使われていた。同じ機能を紹介する個別セッション動画の方では React のコードになっていたのだが、keynote ではあえて Angular を選んでくれたのだろうか。

{{< figure src="/img/io2023-angular-summary/0773a716-34ba-40e7-85f9-5c904a62e8b5/Developer_keynote_(Google_I_O_23)_37-2_screenshot.png" caption="エラースタックトレースの改善" >}}

{{< figure src="/img/io2023-angular-summary/6fb41ad4-82a5-47ed-b98d-9aae983621ff/Developer_keynote_(Google_I_O_23)_37-4_screenshot.png" caption="ソースマップとデバッグ機能の改善" >}}

また、パフォーマンスに関するセクションでは先日リリースされた Angular v16 のパフォーマンス改善を紹介してくれた。Google I/O の keynote でこんな大々的にプロモーションされるのはかなりレアだ。

{{< figure src="/img/io2023-angular-summary/157d00d8-a82d-4872-9e35-aa4af651fbc9/Developer_keynote_(Google_I_O_23)_38-38_screenshot.png" caption="Angular v16 のパフォーマンス改善" >}}

## Angular sessions

今年の Angular 個別セッションは 3 つだった。YouTube の再生リストは [goo.gle/IO23_angular](https://goo.gle/IO23_angular) にまとめてある。

### New in Angular

最初の方は Angular にあまり詳しくない人向けに Angular そのものの紹介から始まるが、途中からは v15 で入った Standalone Components、v16 で入った Signals や SSR の Hydration など最新のアップデート内容もわかりやすく紹介しているので Angular を知っている人もぜひ見てほしい。

{{< youtube "uqWUv0dpib0" >}}

{{< figure src="/img/io2023-angular-summary/e5323a30-25c4-4357-9c18-59716eb71ae3/Whats_new_in_Angular_15-38_screenshot.png" caption="Angular の最近のアップデートの3本柱 Reactivity, SSR改善, QoL改善" >}}

### Rethinking reactivity with Angular Signals

Angular v16 で開発者プレビュー API として公開された Signals API にフォーカスしたセッション。Signals のベースになっている Reactivity という考え方から教えてくれる。まだ Signals を使う予定がなくても、今後はかならず避けて通れない道なので、ぜひキャッチアップしておこう。また、チームメンバーに Signals をレクチャーしなければならないときにも参考資料にできるはずだ。

{{< youtube "EIF0g9LDHcQ" >}}

{{< figure src="/img/io2023-angular-summary/8425e6a4-2e0f-4b0f-b6cd-a778389b6430/Rethinking_reactivity_with_Angular_Signals_9-33_screenshot.png" caption="v16移行のSignalsの計画について" >}}

{{< figure src="/img/io2023-angular-summary/c569a7ca-ec24-457d-9ae5-7a1a072240a7/Rethinking_reactivity_with_Angular_Signals_9-49_screenshot.png" caption="Signals をひとことで。" >}}

### Getting started with Angular Signals

この動画は今年新しく作成されたコードラボを紹介するワークショップセッションになっている。これだけ見て学ぶというよりは、コードラボを進めながら見るのがいいだろう。

{{< youtube "EEzDLpIbW9w" >}}

コードラボはすでに日本語翻訳もあるため、ぜひ Signals を学ぶのに使ってほしい。動画を見てもわかると思うがけっこう面白い本格的な内容になっている。

{{< embed "https://codelabs.developers.google.com/angular-signals?hl=ja#0" >}}

## Firebase 関連

毎年恒例で、Firebase 関連のセッションを見ているといくつか AngularFire 関連のアップデートについて語られることがある。今年は 2 つのセッションで Angular が登場したのでざっくり紹介する。

### **How to run dynamic web apps on Firebase**

[https://youtu.be/MhkDpZA_Ciw?t=499](https://youtu.be/MhkDpZA_Ciw?t=499)

Firebase Hosting と Functions についてのアップデートの中で、Angular Universal のサポートについて言及があった。ライブラリのメンテナンスには今後も投資してくれそうだ。

{{< figure src="/img/io2023-angular-summary/cc0a3d63-7015-467d-bfd7-8403466dc764/How_to_run_dynamic_web_apps_on_Firebase_8-22_screenshot.png" caption="Angular Universal への投資を今後も続けていく" >}}

### **Building with Firebase webframeworks**

[https://www.youtube.com/watch?v=YUwJqZLLjQ0](https://www.youtube.com/watch?v=YUwJqZLLjQ0)

こちらは AngularFire を使って実践的なアプリケーションを開発するコードラボのワークショップセッション。Auth, Storage, Firestore, Functions, Hosting を組み合わせた内容になっているのでなかなかやりごたえがありそうだ。ローカルエミュレータを使った開発も学べるようになっている。

{{< embed "https://firebase.google.com/codelabs/firebase-web-io23?hl=ja#0" >}}

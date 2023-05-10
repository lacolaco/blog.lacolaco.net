---
title: "Perspective of Angular in 2020"
date: 2019-12-24T15:00:16Z
slug: "perspective-of-angular-in-2020"
tags: ["angular", "webdev"]
---

[Angular Advent Calendar 2019](https://qiita.com/advent-calendar/2019/angular)の 25 日目の記事です。

この記事は GDG Tokyo の DevFest 2019 で発表した内容から抜粋、加筆したものです。
2019 年も終わりということで、発表では今年一年の Angular の動きを振り返り、来年以降の展望についてまとめました。
この記事では振り返り部分は割愛し、2020 年以降の Angular のロードマップについてのみ触れることにします。
全篇をご所望の場合はスライドを直接参照してください。

[bit.ly/2Y5ZfJx](http://bit.ly/2Y5ZfJx)

# Roadmap in 2020

2020 年の間には v9.0 から v11.x までのリリースが行われる予定です。半年に一度のメジャーバージョンアップは今後も継続されます。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/9sjiaz24ylo3mkzv452h.png)

v9.0 では次のような大きな変更があります。

- Ivy のデフォルト有効化
- CDK Clipboard API の提供開始
- CDK Testing Harness の提供開始
- @angular/{youtube-player, google-maps} パッケージの提供開始
- テンプレート型チェックの厳密化オプション提供開始

## Ivy への移行スケジュール

v9.0 では、すべてのアプリケーションで Ivy モードでの AoT コンパイルがデフォルト有効になります。

今後 v10.x まではオプトアウトの手段が用意されますが、v11.0 を持ってオプトアウトできなくなります。11.0 がリリースされる予定の 2020 年末には、すべての Angular アプリケーションが Ivy によるコンパイルをおこなっていることを目標にしています。

## CDK の新しい API

Clipboard API は文字列をクリップボードにコピーできるものです。テンプレート内で使えるディレクティブ形式の API と、クラス内で使えるサービス形式の API の両方が提供されています。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/jdzaga3nqhdcpmme3f5r.png)

コンポーネントのテストをサポートするための `ComponentHarness` API も新しく提供されます。 `ComponentHarness` を使うことで、コンポーネントのテストをメンテナンスしやすく記述できます。

テストしたいコンポーネントに対応する Harness を定義し、その Harness に対するテストを書くことで、テストではコンポーネントの実装の詳細に依存せずに宣言的なテストを書けます。同時に Harness の実装では `DebugElement` や `ComponentFixture` などの API が使いやすい形に隠蔽されています。Angular Material のソースコードでは、すべてのコンポーネントが Harness によるテストに切り替えられています。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/6fwy0bik2qvk3zg7vy2w.png)

## Angular official components

Angular 開発チームによる公式コンポーネントライブラリが新たに提供されます。

v9.0 時点では YouTube プレイヤーを表示する `@angular/youtube-player` パッケージと、 Google マップを表示する `@angular/google-maps` パッケージが提供されます。

## Strict Template Type-Checking

Ivy コンパイルの有効化によって、テンプレートの隅々まで型チェックできるようになります。しかし後方互換性のために v9.0 においては厳密なテンプレート型チェックはオプションで提供されます。

`tsconfig.json` の `angularCompilerOptions` で `strictTemplates` フラグを有効にすると、TypeScript の strict モードに近い厳密さでテンプレート型チェックがおこなわれます。

代表的なものでは、イベントハンドラーの `$event` 変数の型チェック、Input の型チェック、コンポーネントメソッドの呼び出し型チェックなどが厳密になります。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/o9jdhu7hnehu6nilvox1.png)

# Imagine the Future

v9.0 以降の Angular の展望は Angular の Values を軸にして予想できます。つまり、

- Apps that users ❤ to use
- Apps that developers ❤ to build
- Community where everyone feels welcome

の 3 つです。なかでもひとつめの "Apps that users ❤ to use"が 2020 年の大きな目標になると考えています。

ng-conf 2019 の keynote からスライドを引用すると、2018 年から 2019 年にかけて、Angular の主なユースケースはエンタープライズアプリケーションでした。

エンタープライズアプリケーションは数は多いですが、ひとつひとつのアプリケーションのユーザーはそれほど多くありません。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/pdtd8uxo3ufhpor2xxov.png)

エンタープライズアプリケーションの開発を支えるために Angular が提供しているのは生産性とスケーラビリティです。Angular CLI によるコード生成や事前コンパイル、ビルドやテストの自動化はチーム開発の水準を高めてくれます。HTML/CSS による UI 開発は多くの開発者の慣れ親しんだ技術スタックです。

静的型チェックや型ベースの Dependency Injection システムもスケーラビリティが重要な開発ユースケースを支えてきました。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/i02nrvikd85y155h8jnh.png)

2019 年の Angular が Ivy を通して取り組んだのは、まだ届いていないユースケースをカバーすることでした。まずはじめに取り組んだのはカジュアルなユースケースです。

デモやプロトタイプ、教材などユーザー数は少ないものの、何度も高速に、簡単に作る必要のあるアプリケーションです。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/7u864ar7jlo5kswpmvbp.png)

カジュアルなユースケースに求められるのは、開発スピードと軽量性です。

Ivy コンパイラで改善した Tree-Shaking によるバンドルサイズの削減や、1 コマンドで PWA 化できる `@angular/pwa` ツール、さらには 1 コマンドでデプロイできる `ng deploy` コマンドなど、小さなアプリケーションを迅速に開発するためのツールを整えてきました。

Stackblitz や UI Bakery のようなビジュアルプロトタイピングツールもサードパーティから登場しており、Angular アプリケーションをカジュアルに作り始める道具は揃ってきています。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/tuv6hs4x8q3uixy5eqov.png)

そして 2020 年、Angular が取り組むのは未踏の領域、大衆向けのアプリケーション開発のユースケースです。

e コマースやニュースサイトのような、コンシューマー向けの巨大な流入を持つユースケースでも Angular の 3 つの Values を発揮できる仕組みを研究中です。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/hszzj8cdz6iz3j4alq1r.png)

コンシューマー向けアプリケーションに求められるのはなんといっても Web パフォーマンスですが、それに加えて変化し続けるニーズに対応しつづけるための柔軟性です。

SEO やアクセシビリティ、国際化やモバイル対応、オフラインなど考慮すべきことが山のようにあります。このようなユースケースではベストプラクティスに固執するだけでなくプロダクトにとって最適な方法論を選べるように、フレームワーク側も柔軟である必要があります。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/e3wh8qv74vvckynk3tfi.png)

## Ionic

コンシューマー向けの Angular アプリ開発としては Ionic が大きなシェアを持っています。ハイブリッドモバイルアプリを開発できる Ionic は Angular CLI に対応し、 `ng add` コマンドで簡単に Angular プロジェクトに組み込めるようになりましたが、Ionic はネイティブとのブリッジだけでなく UI コンポーネントライブラリの側面もあります。

プロダクトの UI をそのまま使い、ハイブリッドアプリに変換するインフラだけ欲しいというニーズのために、Ionic チームは Capacitor というインフラ部分だけのパッケージを提供し、これもまた `ng add` コマンドで Angular アプリケーションにインストールできるようにしました。

また、ビジュアルアプリ開発のための Ionic Studio を使えば、Angular コンポーネントのリアルタイムプレビューや、GUI でのプログラミングも可能です。モバイル向け Angular アプリケーションの開発プラットフォームとして Ionic が急速に成長しています。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/25falcvn758qgrcmbs81.png)

## Work in Progress

Angular 公式にも取り組んでいる Work in Progress なプロジェクトがいくつかあります。

ひとつは新しい i18n API です。これまでの Angular が提供する i18n 機能はテンプレート内だけのものでしたが、現在実装中の機能は TypeScript のコードのなかでも実行時にローカライズができるようになります。国際化が必要なアプリケーションの実装を大いに助けてくれるでしょう。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/vfjyz3pk8rbozpr0zle9.png)

バンドルサイズのさらなる改善を目的に、コンポーネント単位での遅延読み込みも進行中です。これまでは Routing のページ単位でしたが、コンポーネントごとに遅延読み込みできるような仕組みを検討中です。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/c8fkyjsphy8aik96c8s1.png)

最後に、Project Photon を紹介します。ng-conf 2019 で発表された研究段階のこのプロジェクトは、Angular アプリケーションに Progressive Hydration を導入することが目的です。サーバーサイドレンダリングと遅延読み込みを組み合わせ、ユーザーが本当に必要とするまで JavaScript を実行しないような仕組みを模索しています。詳しくは ng-conf 2019 の keynote を見てください。

![Alt Text](https://thepracticaldev.s3.amazonaws.com/i/72w7lx7xke72jygwbpwi.png)

## Scully: Static Site Generator

新しい話題として、Angular のための静的サイトジェネレーター [Scully](https://github.com/scullyio/scully) が公開されました。Scully は公式製ではなくコミュニティの有志で作られたサードパーティツールです。

これまで Angular には GatsbyJS や Gridsome のような静的サイトジェネレーターは存在しなかったため、Scully を起爆剤として JAMstack も Angular のユースケースに加わっていくことでしょう。

## 2020 年の Angular

2020 年の Angular はパフォーマンス改善を続けながら、Ivy 導入によって可能となった i18n を始めとするフレームワーク API の開発・改善を重ねていくことで、これまで弱い部分だったコンシューマー向けのユースケースに手を伸ばしていくことでしょう。

Values の 3 本軸、ユーザーが愛せるアプリケーション（ユーザー体験）、開発者が愛せるアプリケーション（開発者体験）、そして世界中に広がるコミュニティの力で、これまで以上に魅力的な Web 開発プラットフォームに育っていくと期待しています。

それでは良いお年を。

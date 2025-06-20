---
title: 'Angularの学習コストは本当に高いのか？'
slug: 'angular-learning-costs'
icon: ''
created_time: '2019-02-19T00:00:00.000Z'
last_edited_time: '2023-12-30T10:14:00.000Z'
category: 'Idea'
tags:
  - 'Angular'
  - '言語化'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-9ab0d5bb97964cd8bd900d06170682ff'
features:
  katex: false
  mermaid: false
  tweet: true
---

有言実行しなきゃね…

https://twitter.com/laco2net/status/1088352724800794624

この記事では、「学習コストが高い」と評されがちな Angular について、本当にその学習コストは高いのかということについて紐解いていきます。

先に言っておきますが、React や Vue をはじめとする他のフレームワークとの比較はしません。また、なかなか本題に入らない回りくどい文章になる予定なので、予めご了承ください。そして筆者は Angular が大好きです。Angular が好きな人間が書いたポジショントークであることは前提として読んでください。

# そもそも学習コストとは何だ？

まずはじめに、「学習コスト」って何だ？っていうところから始めましょう。名前からして、学習に関するコストであることは予想できます。しかし明確な定義は Google で 1 時間ほど検索した限りでは見つからなかったので、自力で考えていくことにします。

コスト(=費用)と呼ばれる以上、そこには経済活動の概念との共通点があるのでしょう。Wikipedia で “費用” について調べてみました。

https://ja.wikipedia.org/wiki/費用

> 費用（ひよう、英: cost, expense）とは、生産や取引などの経済活動に伴って支払う金銭である。

なるほど、コストとは、何かをおこなうために支払う金銭のことでした。であれば「学習コスト」とは学習をおこなうために支払う金銭ということになります。しかし私たちがプログラミングに関することを学習するときに金銭を払うことはあまり多くありません。代わりに私たちは時間を費やして新しい技術を学習しています。この時間を私たちは「学習コスト」と呼んでいるのでしょう。（プログラミングスクールや有料の教材も増えてきたので、今後は本当に金銭が学習コストになるかもしれません。）

# コストを減らしたいのは誰か？

コストといえば「削減」されるものです。限りある予算のなかでやりくりするために、かかる費用はできるだけ抑えたいものです。では「学習コスト」における予算とは何でしょうか。なぜ学習コストは低いほうがよいのでしょうか。

ここには、日本のソフトウェア開発のメインストリームが労働集約型のシステム開発であったことに起因するものがありそうです。このモデルで利益を大きくするには、人件費は安ければ安いほうがよく、開発期間が短いほうが収益マシーンをたくさん回すことができます。毎回システムの要件も変わりますので、従業員が必要なスキルを習得済みとは限りません。そうなれば従業員に教育を施す必要があります。当然、この教育も短期間で完了することが望ましいです。つまり、**学ばせる側**には**学習コストが低い技術を選択する**インセンティブが発生しています。

一方で、**学ぶ側**にとってはどうでしょうか。ここではプログラマーは自身のスキルを伸ばすこと、ひいては開発者としての市場価値を高め収入を上げることを目的としていると仮定します。ある技術の学習コストが低いということは、誰でもすぐに学べるということです。学習コストが低い技術では、市場価値は上がりにくいでしょう。かといって、学習コストの高い技術を習得したところで、仕事がなければこれも市場価値が上がりません。どの技術が金になるか、というのは時間とともに変わっていき、ある種の賭けのような側面もあります。ここで重要なのは**一度学んだ技術を次に転用できるか**、という観点です。新しい技術が出るたびにゼロから学び直していては時間が足りません。一度払った学習コストを再利用して新しい技術を学ぶことで、複利的にスキルアップしていくのです。つまり、学習コストの単なる高低ではなく、「何を学んだのか」という内訳に意味があるのです。

# コストの資産化

コストには 2 種類あります。**費用の発生と資産の購入です。**支払った資本が、将来の収益の獲得に貢献するならば、それは費用ではなく資産となります。「一度払った学習コストを再利用して新しい技術を学ぶ」というのは、学習コストを資産計上するということです。学習コストが高くても、それが将来に渡って利益を生む資産となるのなら、長期的な観点からその高いコストを払うことが好ましい場面もあります。

ある技術の学習コスト考えるときには、その内訳を考えてみましょう。そのコストの中で資産になる部分、費用になる部分があるはずです。その技術が時代遅れとなり市場で価値がなくなったとき、そのまま無駄になってしまうならそれは費用です。そうでなく、パラダイムシフトを越えて通用する根幹的な技術や概念を学べたなら、それは資産になるでしょう。これはコストの高低には関係ありません。多くが資産になる高コストな技術もあれば、ほとんどが費用になる低コストな技術もあるでしょう。安物買いの銭失いにならないように、資産化しやすい技術を選ぶことがひとつの指針になるかと思います。

さて、ようやく本題にはいる準備ができました。この記事で述べたいのは、Angular の学習コストです。ここまでの話を踏まえて、Angular の学習コストと、その内訳を考えていきましょう。

# Angular の学習コスト（〜入門）

まずは Angular に入門するまでに必要なコストについて見ていきましょう。Angular をはじめるにあたって習得する必要がある技術は、HTML/CSS・TypeScript・Observable（RxJS）です。これに加えて、npm を中心としたエコシステムの Web 開発について基本を理解しておく必要もあるでしょう。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20190219/20190219000741.png)

さて、これらは費用でしょうか。それとも資産になるでしょうか？

## HTML / CSS

これは言うまでもなく資産でしょう。世界中の Web ページを支える Web の基本技術です。Angular を学ぶ以前から資産として持っている人も多いでしょう。Angular ではじめて Web を学ぶという人にとっても、学んでおいて損はない技術です。

## npm エコシステム

npm コマンド無しに Web 開発することは、いまとなってはほぼ皆無に近いでしょう。それほどに npm を中心としたエコシステムは発展し、成熟し、定着しています。資産として計上されて当然でしょう。

## TypeScript

これも大きな資産となるはずです。ここ 2,3 年で TypeScript は広く普及しました。Angular に限らず React や Vue、その他のフレームワークやライブラリでも採用されるケースが増えています。Angular のために学んだ TypeScript の基礎は、別の場所でも活用できるでしょう。

## Observable (RxJS)

RxJS そのものは、Angular の他で使うことはないかもしれません。その場合は費用として捉えることになるでしょう。しかし Observable あるいは Observer パターンという概念は様々な場面で応用可能です。また、Android や iOS といったモバイルアプリの開発においては RxJava や RxSwift といった Rx ファミリーを取り入れている場合もあります。マルチプラットフォームの Flutter で採用されている Dart にも、Observable に似た Stream という仕組みが言語標準で組み込まれています。リアクティブなプログラミングパラダイムにおいて頻出するパターンなので、リアクティブプログラミングの入門として Angular の RxJS を捉えてみれば、資産と見なすこともできるでしょう。

RxJS を除いて、Angular の入門に必要な学習はほぼすべて資産となることがわかりました。はじめての Web 開発というケースでも、Angular を通じて学んだ技術は将来の利益になるでしょう。無駄にはならないので、悩む時間があったらぜひ入門してみましょう。

# Angular の学習コスト（入門〜中級）

入門してからもまだまだ学ぶことはあります。確かに Angular の学習コストは高いのです。Angular 特有の要素で言えば、Component/Directive・依存性の注入・Routing などを学ぶ必要があるでしょう。それに加えて、モダン Web 開発につきものの要素として、状態管理・ユニットテスト・コンポーネント設計・パフォーマンスなどがあります。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20190219/20190219000754.png)

当然モダン Web 開発をおこなう上で必要な技術は汎用的な資産になると考えてよいでしょう。ここでは Angular 特有の要素について詳しく見ていきます。

## Component / Directive

Angular の Component や Directive、Template の仕組みは他に転用できるものではなく、残念ながらほとんどは費用となるでしょう。ただし、すべてがそうなるわけではありません。ここで注目すべきが Web Components です。

Angular の Component は、**Web Components**技術をモデルに設計されています。Component は Custom Element のように独自タグをもち、内部の CSS は Shadow DOM のようにカプセル化されます。デフォルトではエミュレートされた Scoped CSS ですが、実際にネイティブの Shadow DOM を使うように命令することもできます。

さらに、Angular v7 から導入された Angular Elements では、**Angular の Component を Custom Elements に変換する**ことすら可能になりました。一度 Custom Elements としてエクスポートされれば、フレームワークを問わずどこででも利用できるプログラムになります。

Angular の Component は Web Components 技術を学ぶきっかけになりますし、実際に Web Components を活用したアプリケーションを構築するためのツールとして利用することもできる。この点を資産と見なして Angular に投資するのも間違いではないでしょう。

## 依存性の注入

Web フロントエンドではマイナーですが、サーバーサイド言語では依存性の注入は一般的に行われている技術です。これは Angular で学んだ依存性の注入が資産になるというよりは、すでに依存性の注入を学んでいる人にとってのハードルを下げることに繋がる面が大きいでしょう。

また、TypeScript の型情報を利用した宣言的な DI システムは高く評価されており、Angular 以外の場所で使うために模倣した仕組みが作られるケースもでてきました。InversifyJS や NestJS はその一例です。このような面から見ても、まったくの費用であるとは言えません。

https://github.com/inversify/InversifyJS

https://github.com/nestjs/nest

## Routing

Angular の Routing はフレームワークと強く紐づく部分なので、Angular 以外への転用は難しいでしょう。素直に費用と見なして学習します。

入門から中級へスキルアップするにつれて、Angular の学習コストは高くなります。ですが中級まで到達したあとにはアプリケーションについて考える時間が増えることでしょう。コンポーネント設計やテスト設計について思いを巡らせ、スケーラビリティと生産性を向上させる手段として Component/Directive や依存性の注入を活用するフェーズに突入します。Angular が手足のように動き始め、アプリケーションに集中できるようになってきたら、中級者の壁を越えた証です。

# Q. 結論: Angular の学習コストは高いのか？

A. 低くはありません。

アプリケーションを開発するための最短距離だけをたどるならもっと学習コストの低いフレームワークになったでしょう。しかし Angular が選んだのは Web 標準やエコシステムと協調し、未来を見据えたスタックです。そのためには今は寄り道と思えるような学習が必要になりますが、その多くは資産となります。得た資産を元に学習することで更に大きな資産となり、複利的にスキルアップできるようになります。

極論、払ったコストよりも大きなリターンがあるのがわかっていればどれだけ高くてもコストは払えます。ですが現実にはリターンがあるかどうか、不確実性があるから尻込みしてしまいますが、そんなときにはリスクヘッジを考えるべきです。失敗してもある程度の資産が残っていれば全損よりはマシです。そして Angular は多くの資産を残し、リスクヘッジできる技術です。

また、コミュニティが学習コストを下げることができます。誰かが通った道を、後に続く人は楽に歩けるように知見を残していくことができます。そして自分が学んだ知見を残せば、また未来の誰かを助けられます。オープンなコミュニティの存在は学習コストを評価する上で勘定に含めるべきでしょう。Angular 日本ユーザー会はそうした互助の精神でこれまでも、これからも運営されています。Angular を学ぶときにはぜひ参加してみてください。

https://community.angular.jp/

https://angular.jp/

長々とお付き合いいただきありがとうございました。学習コストの高低だけじゃない観点で Angular を評価してくれる人が一人でも増えたら嬉しいです。

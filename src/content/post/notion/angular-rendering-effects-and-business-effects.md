---
title: 'Angular: Rendering EffectsとBusiness Effects'
slug: 'angular-rendering-effects-and-business-effects'
icon: ''
created_time: '2024-06-20T15:00:00.000Z'
last_edited_time: '2024-06-20T23:52:00.000Z'
tags:
  - 'Angular'
  - 'Signals'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Rendering-Effects-Business-Effects-9be76b98487943be8422fa29fd0a884a'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular SignalsのEffectに関する話題でGitHub上の議論が盛り上がっている。

https://github.com/angular/angular/issues/56155

このIssueに投稿されたAngularチームのテクニカルリードのAlexのコメントが、現状のEffectsにまつわる問題をうまく整理している。Effectsの使われ方を”**rendering effects**”と”**business effects**”に二分して考えるというものだ。

[https://github.com/angular/angular/issues/56155#issuecomment-2177202036](https://github.com/angular/angular/issues/56155#issuecomment-2177202036)

そして、まだDeveloper Previewである `effect()` APIのデザインは、コンポーネントで呼び出され “**rendering effects**” を実装するために使われることを狙ったものであるということ、一方で開発者たちは “business effects” を実装するための要素として活用方法を模索・開拓しており、ここで摩擦が起こっているというわけだ。

AlexいわくSignals APIは “bottom up” ならぬ “component up” で設計を始めており、コンポーネントの実装をシンプルにするためのAPIとしてデザインされている。それ以外の用途に適用しようとしてうまくハマらないのは仕方ないということだが、そのことはこれまであまりコミュニティの開発者たちには認識されていなかったようだ。

というわけで、現状の`effects()`APIはコンポーネントから切り離された文脈で使うことは、非推奨とは言わないまでも、そのようにデザインされたものではないと認識したうえで注意深く利用すべきだ。そうでなくてもDeveloper Previewなのでいつでも仕様が変わることを受け入れられる状態にしておかなくてはならない。

---

それはそれとして、この “rendering effects”と”business effects”という切り口は面白く、これを使うとAngularのコンポーネントが持つ責任について整理がつけやすい。コンポーネントを中心に、その状態 (state) と結果 (view) がどのように関係するか、改めて図示すると次のようになるだろう。

![image](/images/angular-rendering-effects-and-business-effects/Untitled.c902b04bb05751ba.png)

コンポーネントは状態をクエリ（読み取り）し、テンプレートを介してビューを構築する。ビューをからコンポーネントはユーザーイベントを受け取り、状態に対してコマンド（書き込み）を行う。これが単純な関係だが、これだけでは表現できない関係をEffectsが担っている。

**Rendering Effects**は状態に応じて**テンプレートでは記述できないビューの構築**を行うための経路である。そして、**Business Effects**はたいていの場合、**状態の変化を起点に別の状態の変化を引き起こす**経路を表現する。たとえば検索パラメータの変更をきっかけに検索を行い、その結果リストを格納するようなものだ。

上述の通り、現状の`effect()`APIはコンポーネントで使われること、特にRendering Effectsの実装のことを念頭において設計されている。そのことを踏まえると、Effectsを宣言するのはコンポーネントの関心事であるとしておいたほうがよさそうだ。Business Effectsの扱いはフレームワークでも未知数であるし、ライブラリ作者たちも当然未知数な状態の上で模索している。たとえばNgRxのSignalStoreでもEffectsに関しては特に踏み込まず、メソッドコールによるPromiseベースの非同期処理と状態の更新手段を素朴に提供するに留めている。賢明な判断だと思う。

https://ngrx.io/guide/signals/signal-store

アプリケーションを実装するうえでも、これらの状況を理解したうえで、あまりがっつりと作り込まないようにしておくのがよいだろう。Developer Previewというのは無意味なラベルではなく、このような不確実性の高いものであることを意味している。


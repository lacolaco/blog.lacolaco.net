---
title: 'なぜAngularJSに$httpが必要だったのか（あるいはAngular HttpClientの価値について）'
slug: 'why-angularjs-needs-http-service'
icon: ''
created_time: '2018-04-20T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'AngularJS'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/AngularJS-http-Angular-HttpClient-b5de8f3306b24e58bb12009345948aa7'
features:
  katex: false
  mermaid: false
  tweet: false
---

https://lacolaco.hatenablog.com/entry/2018/04/20/080000

「レールに乗っておいたほうがいいんじゃないの？」という声もあるとおもうので、 そもそもなぜ Angular は HTTP クライアント機能をスタックとして提供しているのか、というところについて。

## AngularJS には`$http`が必要だった

遡って AngularJS の話をすると、AngularJS にも組み込みの HTTP クライアント機能があり、その API 名からよく`$http`と呼ばれています。

https://docs.angularjs.org/api/ng/service/$http

現在ではこんな感じの API になっています。

```javascript
// Simple GET request example:
$http({
  method: 'GET',
  url: '/someUrl',
}).then(
  function successCallback(response) {
    // this callback will be called asynchronously
    // when the response is available
  },
  function errorCallback(response) {
    // called asynchronously if an error occurs
    // or server returns response with an error status.
  },
);
```

この機能が AngularJS に必要だった理由は以下のダイジェストループによるものが大きいです。

### AngularJS のダイジェストループ

AngularJS は内部のダイジェストループが繰り返し実行されることでコントローラーの変更がビューに反映されます。 一般に HTTP のレスポンスが返ってきたあとにはコントローラーの状態が変わり、取得した値を表示することになるので、 HTTP クライアントが AngularJS のダイジェストループをトリガーできる必要がありました。

必要がありました、とはいえ、AngularJS に詳しければ `$scope.$applyAsync`使えばいいじゃん、というのはありますし、それは正しいです。 しかし XHR が発火するさまざまなイベントのなかで適切にダイジェストループを回すのは難しく、 ダイジェストループのオーバーヘッドは大きいのでうまく出来ないとパフォーマンスが悪化する危険性もあります。

なので、簡単に使えるようにするために、AngularJS のコアと密接な HTTP クライアントが必要でした。

### jQuery の `$.ajax`

当時主流だった `$.ajax` と似た API を持つことで、導入の障壁を下げる狙いもあったかもしれません。

## Angular の HttpClient はなんのためにあるのか

そうした AngularJS の背景をもとに、今の Angular の HttpClient にはどういった価値があるのかを改めて考えることができます。

### Change Detection と Zone.js

Angular にはダイジェストループはなく、ランタイムで発生するほぼすべての非同期処理は Zone.js によって捕捉され、Angular の変更検知システムへディスパッチされます。 XHR を使おうと、Fetch API を使おうと、非同期処理の終了後にはデータバインディングに基づいてビューが更新されます。

つまり、ビュー描画システムとしての Angular と、Angular の HTTP クライアントは完全に分離可能だということです。

### RxJS 親和性

ではなぜ Angular の HTTP クライアントが存在するのか、それは Promise ではなく Observable ベースの HTTP クライアントを導入するためです。 Angular はコアの非同期処理から周辺モジュールまで、多くの非同期処理を RxJS の Observable ベースで実装しています。 そのため、HTTP クライアントの API も Observable を返すように実装されていたほうが、アプリケーション全体で RxJS の恩恵を受けることができます。

RxJS に精通し、使いこなせる開発者にとっては、非常に強力な武器になる API なのは間違いないです。 そして XHR の各種イベントをわかりやすい API として RxJS で実装するのは骨が折れるので、この部分が Angular 公式に提供されていることが最大の価値です。

### フルスタックの信頼性

フルスタックであることでモジュール選択のコストをさげることが目的の場合には迷わず選択できる公式パッケージには大きな意味があるでしょう。

## いつ Angular HttpClient を使わないのか

想像するに次のような場面でサードパーティや独自実装の HTTP クライアントを採用するモチベーションがあると思います。

- RxJS の学習コストを下げたい
  - JavaScript 自体の練度が低い場合、Promise もわからない状態で Observable に手を出すのはハードルが高いでしょう
  - あるいは RxJS をアプリケーションコードでは書きたくないという好みの問題もありでしょう
- すでにサードパーティ HTTP クライアントの知見を持っており、流用できる
  - お気に入りのものがあればそれを使ってよいと思います。

## まとめ

- AngularJS の`$http`と Angular の HttpClient は立場が違う
  - `$http` はどうしても必要だった
- RxJS とどう付き合うかで考えるとよい
- お気に入りのライブラリがあるならそれを使って楽しく開発するのがよい

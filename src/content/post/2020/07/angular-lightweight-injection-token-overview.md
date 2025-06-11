---
title: 'Angular: Lightweight Injection Tokenという新しいテクニック'
slug: 'angular-lightweight-injection-token-overview'
icon: ''
created_time: '2020-07-29T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Lightweight-Injection-Token-66159df0e34842f19a275319c346cdc3'
features:
  katex: false
  mermaid: false
  tweet: false
---

最近Angularチームが発見し、Angularライブラリの実装におけるパターンとして普及させようとしているのが、 **Lightweight Injection Token** というテクニックだ。これはこれまで不可能だった **コンポーネント(ディレクティブ)のTree-Shaking** を可能にする。本稿ではこの新しいテクニックの概要、そして生まれた経緯や深く知るための参考リンクをまとめる。

なお、Lightweight Injection Tokenについては公式ドキュメントでも解説される予定であるため、そちらを参照すればいい部分は省略する。

[Angular - Optimizing client app size with lightweight injection tokens](https://next.angular.io/guide/lightweight-injection-tokens)

## Lightweight Injection Tokenの概要

ひとことでいえば、「オプショナルな機能に関連するInjection Tokenとして代替の軽量トークンを使う」ということである。AngularのDIを深く理解していればこれだけでピンと来るかもしれないが、具体例から概要をつかもう。

あるAngularライブラリが、次のような使い方ができる `<lib-card>` コンポーネントを提供している。

```html
<lib-card> Hello World! </lib-card>
```

このコンポーネントは、Contentとして `<lib-card-header>` コンポーネントを配置すると、カードのヘッダーとして取り扱う **オプショナル** な機能があることをイメージしよう。

```html
<lib-card>
  <lib-card-header>Greeting Card</lib-card-header>
  Hello World!
</lib-card>
```

ライブラリ側はこのような使い方ができるコンポーネントを実装するとおおよそ次のようになるだろう。 `@ContentChild()` を使って `CardHeaderComponent` の参照を得る。ただしこのヘッダーを置くかどうかはユーザー次第なので、 `CardHeaderComponent|null` という形でnullを許容することになる。

```
@Component({
  selector: 'lib-card-header',
  ...,
})
class CardHeaderComponent {}

@Component({
  selector: 'lib-card',
  ...,
})
class CardComponent {
  @ContentChild(CardHeaderComponent)
  header: CardHeaderComponent|null = null;
}
```

ここで問題になるのが、 `CardComponent` から `CardHeaderComponent` への参照の持ち方である。 `@ContentChild(CardHeaderComponent)` と `header: CardHeaderComponent|null` の2箇所で参照を持っているが、この2つは性質が異なる。

後者の `header: CardHeaderComponent|null` は、**型**としての参照である。この参照はTypeScriptのコンパイル時型チェックにのみ用いられ、コンパイル後のJavaScriptには残らないため問題にならない。

問題は前者の `@ContentChild(CardHeaderComponent)` だ。これは**値**としての参照であり、 `CardHeaderComponent` というクラスオブジェクトそのものを参照している。それが直接 `@ContentChild()` デコレーターに渡されているのだから、**ユーザーがヘッダーを使おうが使わまいが、この参照は実行時に残る**。

`@ViewChild()` や `@ContentChild()` の走査条件として使われるコンポーネント/ディレクティブのクラス参照はどうしてもTree-Shakingできず、これがAngularライブラリを利用したときの**バンドルサイズの肥大化の原因**となる。

これを解決するためのアプローチが、Lightweight Injection Tokenだ。上記の例で `@ContentChild()` デコレーターに渡していたクラスを、次のように軽量なオブジェクトを利用したInjection Tokenに置き換える。

```
// Lightweight Injection Token
abstract class CardHeaderToken {}

@Component({
  selector: 'lib-card-header',
  providers: [
    {provide: CardHeaderToken, useExisting: CardHeaderComponent}
  ]
  ...,
})
class CardHeaderComponent extends CardHeaderToken {}

@Component({
  selector: 'lib-card',
  ...,
})
class CardComponent {
  @ContentChild(CardHeaderToken) header: CardHeaderToken|null = null;
}
```

まず `CardHeaderToken` 抽象クラスを作成し、 `CardHeaderComponent` をその具象クラスとする。そしてコンポーネントプロバイダーで `CardHeaderToken` に対して自身のクラスオブジェクトを提供する。 `CardComponent` ではトークンを `@ContentChild()`デコレーターの走査条件とする。

これにより、 `CardComponent` から直接の `CardHeaderComponent` への参照はなくなり、ライブラリのユーザーが `<lib-card-header>` コンポーネントを呼び出したときだけ `CardHeaderToken` に対して `CardHeaderComponent` クラスのインスタンスが提供されることになる。

`@ContentChild()` や `@ViewChild()` の引数としてDIトークンを渡せるようになるのがバージョン 10.1.0からなので、このアプローチが取れるのは**バージョン 10.1.0以降**になる（ `as any` で突破する手法はあるが）。

[feat(core): support injection token as predicate in queries (#37506) · angular/angular@97dc85b](https://github.com/angular/angular/commit/97dc85ba5e4eb6cfa741908a04cfccb1459cec9b)

## なぜ今なのか、これまでの経緯

この問題は昔からずっと存在したが、実はバージョン8まではそれほど重大な問題ではなかった。なぜかというとバージョン8以前、つまりIvy以前 (ViewEngine, VE) はAOTコンパイルによってテンプレートコンパイルされた結果の生成コードが、もとのコンポーネントとは別のクラス実体をもっていたからだ。

ViewEngineでは `CardComponent` クラスのデコレーターとそのメタデータをもとに `CardComponentNgFactory` クラスが生成される。そして、JavaScriptとしてコードサイズが大きいのはほとんどの場合NgFactory側である。

つまり上記の例でいえば、 たとえ `CardComponentNgFactory` クラスが `CardHeaderComponent` への参照を持っていたとしても、`CardHeaderComponent` そのものが大きくないために問題にならなかったのだ。サイズが大きいのは `CardHeaderComponenNgFactory` のほうで、NgFactoryは テンプレート中で `<lib-card-header>` を使わない限り参照されないため、不完全ではあるがTree-ShakingできていたのがViewEngine方式だった。

バージョン9からデフォルトになったIvy方式のAOTコンパイルは、生成コードを **もとのクラスの静的フィールドとして合成する**。よって AOTコンパイルすると `CardHeaderComponent` そのもののサイズが大きくなり、 `CardComponent` に巻き込まれて一緒にバンドルされるサイズが顕著に大きくなる。いままで行なわれていた生成コードのTree-ShakingがIvyによりなくなってしまった。

つまり、Lightweight Injection TokenはViewEngine時代には顕在化していなかったがIvyによってクリティカルになった問題を解決するために編み出された、**Ivy時代のAngualrライブラリ実装パターン**である。

もっともポピュラーなAngularのコンポーネントライブラリであるAngular Materialではバージョン9リリース時からバンドルサイズの増加が報告されており、その解消の過程でAngularチームが辿り着いた答えである。現在Angular ComponentsチームはAngular Materialの各コンポーネントをLightweight Injection Tokenパターンに置き換える作業を進めている。

https://github.com/angular/components/issues/19610

[Use light-weight injection pattern for optimized tree-shaking/bundle size · Issue #19576 · angular/components](https://github.com/angular/components/issues/19576)

## コンポーネント以外のLightweight Injection Token

ところで、 `@ContentChild()` などの走査条件でなくとも、通常のDIの中でもオプショナルなものについてはLightweight Injection Tokenパターンを使うべきである。 `@Optional()` を使っていてもそのトークンの参照は残るためTree-Shakingはできない。コンストラクタDIでは型注釈部分にしか参照がないためコンパイルすれば消えそうに見えるが、コンストラクタ引数の型注釈はAOTコンパイル時に自動的に `@Inject()` デコレーターに変換されるため、実体参照をもつのである。つまりこれも `@ContentChild()` と全く同じ構造であり、同じ問題をもちうる。ライブラリ作者であればオプショナルなプロバイダーのトークンは可能な限り軽量にしておくべきだろう。

```
class MyComponent {
  constructor(@Optional() srv: OptionalService) {}
}

// Same
class MyComponent {
  constructor(@Optional() @Inject(OptionalService) srv: OptionalService) {}
}
```

ちなみにコンポーネントのLightweight Injection Tokenとして `InjectionToken` オブジェクトを使うこともできるはずだ。公式ドキュメントでは抽象クラスの例が紹介されているが、どちらが定着するかは今後のコミュニティでの受け入れられ方次第だろう。ただ、トークンの抽象クラスとコンポーネントクラスを継承関係にするとそのままコンポーネントのAPI定義として利用もできるため、おそらくは抽象クラスのほうが便利な場面は多そうだ。

```
const CardHeaderToken
  = new InjectionToken<CardHeaderComponent>("CardHeaderComponent");
```

[https://angular.io/guide/dependency-injection-providers#non-class-dependencies](https://angular.io/guide/dependency-injection-providers#non-class-dependencies)

## 参考リンク

以下に参考リンクをまとめる。

- Misko HeveryによるDesign Doc [https://hackmd.io/@mhevery/SyqDjUlrU](https://hackmd.io/@mhevery/SyqDjUlrU)
- 公式ドキュメントへの追加PR [https://github.com/angular/angular/pull/36144](https://github.com/angular/angular/pull/36144)
- Angular MaterialのIssue [https://github.com/angular/components/issues/19576](https://github.com/angular/components/issues/19576)

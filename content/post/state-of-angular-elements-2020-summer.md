---
title: 'Angular Elementsの現在地 (2020 Summer)'
date: 2020-09-22T15:23:44+09:00
updated_at: 2020-09-22T15:23:44+09:00
tags: ['angular', 'angular-elements', 'customelements', 'webcomponents']
---

<div style="text-align: center;">
    <img src="/img/state-of-angular-elements-2020-summer/2020-09-22T17-35-00.png">
</div>

本稿では 2020 年夏（Angular v10.1） 時点において Angular Elements がどのような状態にあるのかを簡潔にまとめる。すでに達成されていることと、まだ達成されていないことを手早く把握できることを目的とする。Angular Elements の将来については [公式ロードマップ](https://angular.jp/guide/roadmap) に書かれていないことを独自に述べることはない。

## Angular Elements の基本仕様

Angular Elements に触れたことがない読者のために、Angular Elements の基本的な仕様を解説する。Angular Elements とは、Angular コンポーネントを Web 標準の Custom Elements にコンバートすることで、Angular アプリケーションの外でも利用できるポータブルなコンポーネントを作る機能のことである。（[公式ドキュメント](https://angular.jp/guide/elements)）

ライブラリとして提供される API はシンプルで、 `@angular/elements` パッケージの `createCustomElement()` 関数にコンポーネントクラスを渡すだけである。Custom Element にコンバートされたコンポーネントは元の Angular アプリケーションからは独立し、そのコンポーネントを頂点とする小さな Angular アプリケーションのように振る舞う。ただし、DI の解決に関してはコンバート時にベースとなる `Injector` を受け取っておく必要がある。

```ts
@Component({...})
export class MyButtonComponent {}

import { createCustomElement } from '@angular/elements';

@Ngmodule({})
export class AppModule {

  constructor(injector: Injector) {
    // Convert a component into an element
    const MyButtonElement = createCustomElement(MyButtonComponent, { injector });
    // Register a custom element
    document.customElements.define('my-button', MyButtonElement);
  }
}
```

つまり、Angular Elements を利用するためには、Injector を確保するために少なくともひとつのルート NgModule が bootstrap される必要がある。言い換えれば、複数のコンポーネントをひとつの NgModule 内で一気に Custom Elememts 化することもできる。

基本的にどんな Angular コンポーネントでも、それが Angular アプリケーション中で動作するならば Angular Elements によってコンバートできる

## Web 標準仕様への準拠

まずはじめに、Angular Elements という機能が Web 標準仕様にどれほど準拠できているかをまとめる。逆に Angular アプリケーション内で Custom Elements を利用するケースについては [Custom Elements Everywhere](https://custom-elements-everywhere.com/) にまとめられているのでそちらを参照すること。

### Custom Elements

**サポート済みの機能**

- Input と属性の自動マッピング
  - コンポーネントの Input から自動的に `observeAttributes` を設定
  - `attributeChangedCallback` から変更検知をトリガーして再描画
- Output とカスタムイベントの自動マッピング
  - Output は同名のカスタムイベントとして `addEventListener()` などで購読可能

**未サポートの機能**

- 標準 HTML 要素の拡張
  - `HTMLElement` クラス以外を継承するためには独自に `ElementStrategy` を定義する必要がある
  - [https://github.com/angular/angular/issues/34607](https://github.com/angular/angular/issues/34607)

### Shadow DOM

Angular コンポーネントはデフォルトでカプセル化 CSS の機構を持っている。Angular Elements でコンバートされてもその機構はそのまま維持されるため、グローバルスタイルを汚染することはない。

**サポート済みの機能**

- ネイティブ Shadow DOM の利用
  - オプトインの機能として `ViewEncapsulation.ShadowDom` を設定できる
- `<slot>` サポート （`ViewEncapsulation.ShadowDom` 時のみ）
  - Angular テンプレート中の `<slot>` はそのまま残り、 `::slotted()` も利用できる
  - `ShadowDom` 以外のときには動作しない

**未サポートの機能**

- `<ng-content>` から `<slot>` への自動変換
  - `<ng-content>` は ViewEncapsulation 設定によらず Angular アプリケーション中では正しく動作するが、 `<slot>` は `ShadowDom` 設定のとき、かつ Custom Elements にコンバートされたあとにしか動作しない
- Shadow Parts のエミュレーション
  - Shadow Parts による外部からのスタイリングは `ShadowDom` 設定のときのみ機能する
  - `::ng-deep` を利用せず外部からスタイリングする方法がまだ確立されていない

## ユースケース

v6.0 とともに Angular Elements がリリースされてから 2 年、当初想定されたユースケースはいまでも主眼に置かれているが、それ以外のユースケースも生まれている。

### 静的コンテンツ中の埋め込み動的コンテンツとして

コンポーネントを Custom Elements として利用することで、動的なコンポーネントの挿入、更新、破棄などライフサイクルの管理を Web ブラウザに一任できるという戦略。これは Angular の動的コンポーネントが静的コンテンツと相性が悪いという問題に根ざしており、これが根本的に解決されればこのユースケースの重要度は下がるだろう。

具体的な用例でいえば、 [angular.io](http://angular.io) 内のサンプルコードや StackBlitz へのリンクなどは Angular Elements で表示されている。 `<code-snippet>` のような Angular Elements をあらかじめ登録しておき、Markdown のドキュメンテーション中でタグを記述すればドキュメント中にリッチなコンテンツを展開できるようになっている。

![code-exampleタグの様子](/img/state-of-angular-elements-2020-summer/2020-09-22T17-30-55.png)

### Angular への段階的移行ツールとして

当初は想定されていなかったがコミュニティの中で醸成され、ついには Google 自らも採用するに至った AngularJS から Angular への段階的移行パスである。事実上これが AngularJS からの移行のベストプラクティスとなっている。これについては別の記事でも取り上げている。

[Angular Elements による AngularJS の段階的アップグレード戦略](/2019/08/upgrading-angularjs-app-with-angular-elements/)

このユースケースの要諦は、古いコードベースを減らしながら新規実装を進めるクロスフェード式の移行ができることである。新しく作った Angular コンポーネントを Custom Elements にすることで既存の Web ページの DOM ツリーの一部を少しずつ置き換えていき、ページ全体が Angular Elements で構成されるようになったときには、すでに Angular アプリケーションとしても置き換えられるコンポーネントが揃っているという算段である。

### 未成熟: 汎用 Custom Elements ライブラリのコードベースとして

発表当初にあった、フレームワークに依存しない汎用コンポーネントライブラリのコードベースとして Angular を利用できるのではないか、という期待は今のところまだ実用段階にない。

主な理由は Custom Elements を登録するための JavaScript のサイズがいまだ大きいことにある。Angular コンポーネントそのものに加え、コンポーネントをラップして Custom Elements に変換する層、そして NgModule とそれを bootstrap する platform 層など、ひとつの Angular Elements を生成するために必要なものがまだ多い。
すでにReactやVue.jsなどのライブラリが存在するページにさらにAngular Elementsまで追加するのは多少のパフォーマンスの犠牲が必要になるだろう。
将来的に NgModule 無しでのアプローチなどが生まれてくれば実用性は上がってくるかもしれない。

## まとめ: Angular Elements に不足しているもの

2020 年夏現在、Angular Elements に不足していると思われるものを以下にまとめる。

- 標準 HTML 要素の `extends` のサポート
  - `<my-button>` 要素を `extends: 'button'` できるようになれば `<button myButton>` のような属性セレクタ形式のコンポーネントを正しく変換できるようになる
- `<ng-content>` と `<slot>` の透過的なサポート
- `ViewEncapsulation.Emulated` での Shadow Parts サポート
- ドキュメンテーションとロードマップ
  - リリース直後からドキュメンテーションはあまりアップデートされておらず、現在のユースケースに合わせたものに洗練されると良い。Slot や Shadow Parts など新しい標準仕様に関する記述も不足している
  - また Zone.js や NgModule のオプトアウト化なども絡めた将来のロードマップにも期待したい
- 世界の脱 Internet Explorer
  - ShadowDom を使わなければ基本的に polyfill で困ることはないが、信頼性やパフォーマンスなどの面で重要である

つまりほとんど問題なく使えるため、ぜひ活用してコミュニティから需要や期待、フィードバックを発信してほしい。

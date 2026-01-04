---
title: 'なぜentryComponentsは非推奨になるのか'
slug: 'why-entrycomponents-will-be-deprecated'
icon: ''
created_time: '2019-11-04T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/entryComponents-56463883d9204375a2f4f76b6fcf3c88'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では、Angular v9.0 にて非推奨となる `entryComponents` 機能が、なぜ非推奨になるのかについてできるだけ簡単に解説します。

[Angular - Deprecated APIs and Features](https://next.angular.io/guide/deprecations#entrycomponents-and-analyze_for_entry_components-no-longer-required)

## はじめに

解説を始める前に、重要な点をあらかじめ書き記しておきます。

- もし Ivy をオプトアウトする場合は、 `entryComponents` は引き続き必要です。決して削除しないでください。
- いままで `entryComponents` 機能を使ったことがない方が新たになにか覚える必要はありません。興味がなければ過去のものとして無視してください。

## `entryComponents` とは何なのか

v9.0 で非推奨となる `entryComponents` とは何だったのかということをまずは振り返りましょう。

`entryComponents` は多くの場合、 **動的なコンポーネント** を実現するために利用されます。動的なコンポーネントとは、Angular のテンプレート HTML 内に登場せず、コードの実行によって生成されるコンポーネントです。テンプレート HTML を静的に検査しても宣言が見つからないことから **動的** と呼ばれます。

[Angular - 動的コンポーネントローダー](https://angular.jp/guide/dynamic-component-loader)

もっとも代表的なユースケースはダイアログやモーダルのようなケースです。コンポーネントクラスの処理が実行されることで動的にコンポーネントが表示されます。このようなコンポーネントはテンプレート HTML 内に宣言されません。

たとえば Angular CDK の[Overlay API](https://material.angular.io/cdk/overlay/overview)を使ってコンポーネントをオーバーレイ上に表示するには次のようなコードを書きます。

```typescript
export class AppComponent {
  constructor(private overlay: Overlay) {}

  openModal() {
    const overlayRef = overlay.create();
    const modalPortal = new ComponentPortal(MyModalComponent);
    overlayRef.attach(modalPortal);
  }
}
```

このとき、動的に表示したい `MyModalComponent` は、 それが宣言される `NgModule` の `entryComponents` 配列に追加される必要があります。

```typescript
@NgModule({
  declarations: [AppComponent, MyModalComponent],
  entryComponents: [MyModalComponent]
})
export class AppModule {}
```

## なぜ `entryComponents` が必要なのか

Angular に慣れている人にとっては、もはや当たり前のように「モーダルを実装するときは `entryComponents` 」というルーチンになってしまっているかもしれませんが、そもそもなぜこれが必要なのでしょうか。その理由は、Angular v8 までの AoT テンプレートコンパイラと、そのテンプレートコンパイラが生成する実行コードに理由があります。

ここで以降の説明の簡単のため、v8 以前の AoT コンパイラを **ViewEngine** (VE) コンパイラと呼びます。

### コンポーネントの生成と ComponentFactory

動的コンポーネントの生成には `ComponentFactoryResolver` という API を使います。この API はコンポーネントクラスから、そのコンポーネントに対して AoT コンパイラが生成した **ComponentFactory** オブジェクトを返すものです。

```typescript
export class AppComponent {
  constructor(private cfr: ComponentFactoryResolver) {}

  ngOnInit() {
    const componentFactory = this.cfr.resolveComponentFactory(SomeComponent);
  }
}
```

先ほど紹介した CDK の Overlay や Portal の機能も、この `ComponentFactoryResolver` を利用しています。そして、 `entryComponents` に追加されたコンポーネントだけがこの `resolveComponentFactory` メソッドの引数に使えます。もし追加されていなければ次のようなエラーが表示されます。

![image](https://thepracticaldev.s3.amazonaws.com/i/y832ijip6kq9xmouhvvg.png)

つまり、 `entryComponents` とは、「あるコンポーネントの ComponentFactory を解決可能にする」ための機能であると言えます。ではなぜ `entryComponents` に追加されていないコンポーネントの ComponentFactory は解決できないのでしょうか。すべてのコンポーネントは等価ではないのでしょうか？

### ViewEngine は Tree-shakable な ComponentFactory を生成する

その答えは半分 YES です。ViewEngine の AoT コンパイラは `NgModule.declarations` 配列に指定されたすべてのコンポーネントの ComponentFactory を生成しています。しかし、それが `ComponentFactoryResolver` から解決可能になっていないのです。

この様子は実際に AoT コンパイルの結果を見るとはっきりとわかります。Angular CLI のプロジェクトであれば、 `ngc -p ./tsconfig.app.json` とコマンドを実行すれば `tsc-out` ディレクトリに AoT コンパイル結果が出力されます。その中には、すべてのコンポーネントに対して `./some.component.ngfactory.js` のような ComponentFactory の生成コードを見ることができます。

![image](https://thepracticaldev.s3.amazonaws.com/i/ksacrf6s6j49dn18iofg.png)

これで ViewEngine ではどのコンポーネントにも ComponentFactory は存在していることがわかります。しかし、これらの ComponentFactory は **どこからも参照されていません**。つまり Angular CLI（の内部で使われている webpack）のビルドでは、不要なコードとしてバンドルに含められないのです。これが、`ComponentFactoryResolver` によって ComponentFactory を解決できないコンポーネントがある理由です。バンドルサイズ削減のために、不要なコードを含めない仕組みになっているのです。

### Component と ComponentFactory の分断

しかしこれはおかしい話です。ソースコード中で `SomeComponent` を参照しているのだからその ComponentFactory は必要なコードとしてバンドルに含められるべきです。

ここが ViewEngine の限界です。ViewEngine の AoT コンパイラは ComponentFactory の生成コードを元のコンポーネントクラスとは別のファイルに出力します。つまり、 `some.component.ts` に対して `some.component.js` と `some.component.ngfactory.js` を出力します。したがって、アプリケーションで `SomeComponent` への参照があったとしても、 `SomeComponent` の ComponentFactory には一切参照が届かないのです。

![image](https://thepracticaldev.s3.amazonaws.com/i/936ej8535g3gtybmoxnz.png)

### `entryComponents` は `ComponentFactoryResolver` をセットアップする

ここでようやく `entryComponents` の出番です。 `NgModule` の `entryComponents` に追加されたコンポーネントの ComponentFactory は、AoT コンパイラが特別に解釈して `ComponentFactoryResolver` で解決できるように参照を作ります。その様子は AoT コンパイル後の `app.module.ngfactory.js` で見ることができます。

![image](https://thepracticaldev.s3.amazonaws.com/i/db6vv7ojx2mqk7mo55uu.png)

AoT コンパイルの生成コードをはじめて見る方は驚くかもしれませんが、今回注目すべき点は 2 ヶ所。インポート文と `ComponentFactoryResolver` のプロバイダ宣言です。見ての通り、 `AppModuleNgFactory` から参照されているのは `app.component.ngfactory` だけです。そして、 `ComponentFactoryResolver` の近くにある配列には `AppComponentNgFactory` だけがセットされています。

それでは、 `SomeComponent` を `entryComponents` 配列に追加してもう一度 AoT コンパイルしてみましょう。 `app.module.ngfactory.js` に変化があるはずです。

![image](https://thepracticaldev.s3.amazonaws.com/i/bszkaslhwu3bai9vtceg.png)

新たに `some.component.ngfactory` への参照が追加され、`ComponentFactoryResolver` の近くにある配列に `SomeComponentNgFactory` が追加されています。実はこの配列こそが `ComponentFactoryResolver`が解決できるコンポーネントのリストです。

つまり、`entryComponents` によって `NgModule` のコンパイル結果に影響を与えることで、動的に利用したいコンポーネントの ComponentFactory が Tree-shaking されないように、`ComponentFactoryResolver` から解決可能な参照を保持することができるのです。

## なぜ `entryComponents` が非推奨になるのか

ViewEngine において `entryComponents` がなぜ必要だったかを簡単に説明しましたが、なぜ v9 からは非推奨となるのでしょうか。それは ViewEngine に変わる Angular の新しい **Ivy**コンパイラが ViewEngine の抱える問題を根本から解決したからです。

### Ivy は同一ファイルにコード生成する

Ivy の AoT コンパイラは元のコンポーネントファイルと同じファイル、しかも同じクラスの静的フィールドとしてコード生成します。実際に AoT コンパイル結果を見てみましょう。v9 では次のような生成コードになります。Ivy では AoT コンパイルによって追加される独自のファイルは一切ありません。

![image](https://thepracticaldev.s3.amazonaws.com/i/bj6x27pj91vgbvu6h3jm.png)

`some.component.js` は次のようになっています。3 行目にあるのは元の `SomeComponent` から `@Component` デコレーターが除去されたクラスです。そしてデコレーターの中に定義されていたセレクターやテンプレートなどのメタデータが、 9 行目以降の AoT コンパイラによる生成コードに変換されています。

![image](https://thepracticaldev.s3.amazonaws.com/i/p2q707m1e3rtd5xobkf1.png)

ここで重要なことは、 `SomeComponent` の AoT コンパイル後コードが、 `SomeComponent` クラスと密に結合していることです。これにより、 `SomeComponent` を参照すれば自動的に `SomeComponent` のコンポーネント生成に必要なすべての情報を解決できます。

つまり、 `app.module.js` で `some.component.js` をインポートしているだけで、 `SomeComponent` の ComponentFactory は解決可能になるのです。

![image](https://thepracticaldev.s3.amazonaws.com/i/4bdke2arab01ajubqkxb.png)

これが、 Angular v9 で Ivy によって `entryComponents` が非推奨になる理由です。 `entryComponents` の代替となる新たな方法に変わるのではなく、そもそも根本的に**動的コンポーネントと静的コンポーネントを区別する必要がなくなる**のです。

### Tree-shaking の問題は？

ここまで読んだ方はもしかすると `entryComponents` がなくなることで、ViewEngine と比べてバンドルサイズが増えるのではないかと疑っているかもしれません。確かに、コンポーネントの生成コードだけを考えると、ViewEngine と比べて Tree-shaking 可能な領域は減っています。しかし Ivy ではその他のいくつもの改善によってトータルではほとんどのユースケースでバンドルサイズが削減されます。

もっとも大きな改善は、Angular のテンプレート機能が Tree-shakable になることです。詳細は割愛しますが、 `[prop]="someValue"` や `(eventName)="onEvent($event)"` など、すべてのテンプレートの機能が個別に Tree-shaking されます。アプリケーションで一度も使わなかったテンプレート機能はバンドルに含まれません。

また、コンポーネントと生成コードが同一ファイルになることでクラス定義や import/export のオーバーヘッドもなくなり、より少ないコードだけを生成すればよくなりました。また、ViewEngine ではコンポーネントが子コンポーネントになる場合とホストコンポーネントになる場合で別の生成関数を定義していましたが、Ivy ではひとつの生成関数に統合されるので、これによっても生成コードのサイズは減っています。

トレードオフはありつつも、Ivy では差分コンパイルのスピード、バンドルサイズの削減、内部アーキテクチャの単純化などの複合的な視点で、Ivy のアーキテクチャを選択しています。

### 動的コンポーネントを超えた遅延コンポーネントへ

Ivy の AoT コンパイラは同一クラスの静的フィールドに ComponentFactory を生成すると説明しました。この変更による恩恵は `entryComponents` が不要になるだけではありません。ひとつのコンポーネントに関するコードが 1 ファイルに含まれることで、Dynamic Import によるコンポーネントの遅延読み込みも可能になります。

つまり、次のように動的な `import()` 文で取得した `SomeComponent` クラスでも `ComponentFactoryResolver` で解決できるということです。

```typescript
export class AppComponent {
  constructor(private cfr: ComponentFactoryResolver) {}

  ngOnInit() {
    import("./some/some.component")
      .then(m => this.cfr.resolveComponentFactory(m.SomeComponent))
      .then(someCompFactory => {
        console.log(someCompFactory);
      });
  }
}
```

Ivy ではすべてのコンポーネントの ComponentFactory がバンドルに含められると説明しましたが、それはテンプレート HTML や TypeScript コードの中で **静的に** 参照されている場合だけです。もし `SomeComponent` がこの Dynamic Import 以外でまったく参照されていなければ、 Angular CLI は `SomeComponent` そのものを別バンドルに分離し、遅延読み込み可能にします。モーダル用のコンポーネントであれば、初期読込される JavaScript にはコンポーネントを含めず、モーダルを表示するイベントが発生したときに初めて遅延読み込みすればいいわけです。

このように ViewEngine から Ivy にアーキテクチャ変更したことによって、いままでは覚えるしかなかった「Angular ではできない」や「Angular ではこのようにする」といった慣例的な制約がいくつも取り払われています。そして不要になった（陳腐化した）API は非推奨となっていきます。

非推奨化は必ずしも代替 API への置き換えを意味するわけではないということを覚えておきましょう。

## まとめ

- v8 までの ViewEngine では `entryComponents` が無ければ ComponentFactory の解決ができなかった
- Ivy ではすべてのコンポーネントが常に ComponentFactory を保持しているため、いつでもどのコンポーネントも動的に利用できるようになる
- `entryComponents` の非推奨化は代替 API への置き換えではなく、そもそも動的コンポーネントと静的コンポーネントの区別が不要になったということである

Ivy についての詳しい話は、 AngularConnect 2019 での次のセッションをおすすめします。

- [Deep Dive into the Angular Compiler | Alex Rickabaugh](https://www.youtube.com/watch?v=anphffaCZrQ&list=PLAw7NFdKKYpE-f-yMhP2WVmvTH2kBs00s)
- [How Angular works | Kara Erickson](https://www.youtube.com/watch?v=S0o-4yc2n-8&list=PLAw7NFdKKYpE-f-yMhP2WVmvTH2kBs00s&index=26)
- [How we make Angular fast | Miško Hevery](https://www.youtube.com/watch?v=EqSRpkMRyY4&list=PLAw7NFdKKYpE-f-yMhP2WVmvTH2kBs00s&index=10)
- [The secrets behind Angular’s lightning speed | Max Koretskyi](https://www.youtube.com/watch?v=nQ8oJ1rpwIc&list=PLAw7NFdKKYpE-f-yMhP2WVmvTH2kBs00s&index=7)


---
title: 'AsyncPipeの初期値null問題と非同期データバインディング'
slug: 'async-pipe-initial-null-problem'
icon: ''
created_time: '2020-02-18T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
tags:
  - 'Angular'
  - 'RxJS'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/AsyncPipe-null-289a7964b9894c20818f45f429907bd1'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angularの [AsyncPipe](https://angular.io/api/common/AsyncPipe) は非同期データをテンプレートバインディングするのに便利な機能だが、実は実装当初からずっと大きな問題を抱えている。それが「初期値null問題」だ。 本稿ではAsyncPipeの初期値null問題とその根本的原因を解説し、この問題を解決するための新しい非同期データバインディングのあり方を論じる。

## AsyncPipeの仕組みを理解する

一般的なAngularアプリケーションを作る上でいまやAsyncPipeは必ず使われるものと言っても過言ではない。Observable型のデータを購読し、そのスナップショットをデータバインディングするために多用される。 基本的な使われ方は次のような形だ。

```
@Component({
  selector: "app-root",
  template: `
    <div *ngIf="source$ | async as state">
      {{ state.count }}
    </div>
  `,
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  source$ = interval(1000).pipe(map(i => ({ count: i })));
}
```

さて、AsyncPipeはどのようにして、 `source$` が流す値をテンプレートにバインディングし、レンダリングさせているのだろうか？ [AsyncPipeの実装](https://github.com/angular/angular/blob/9.0.1/packages/common/src/pipes/async_pipe.ts#L71) を見てみよう。

AsyncPipeはPromiseとObservableのどちらでも扱えるように非同期データの抽象化のコードが多いが、本質的な部分が次のコードだ。他のどのPipeとも同じく、`transform()`メソッドを実装している。

```
  transform(obj: Observable<any>|Promise<any>|null|undefined): any {
    if (!this._obj) {
      if (obj) {
        this._subscribe(obj);
      }
      this._latestReturnedValue = this._latestValue;
      return this._latestValue;
    }

    if (obj !== this._obj) {
      this._dispose();
      return this.transform(obj as any);
    }

    if (ɵlooseIdentical(this._latestValue, this._latestReturnedValue)) {
      return this._latestReturnedValue;
    }

    this._latestReturnedValue = this._latestValue;
    return WrappedValue.wrap(this._latestValue);
  }
```

上から順番に処理を見ていこう。最初の `if (!this._obj)` は、AsyncPipeに初めてObservableが渡されたときの条件で、つまり初期化処理である。 `this._obj` がない かつ `obj` があれば、 `obj` を購読する。`obj` が 最初の例の `source$` にあたる。AsyncPipeに渡したObservableはここで `subscribe()` される。

次のif文は 購読中のObservableとは別のObservableが渡されたときで、これは今の購読を disposeして、再購読を始めるようになっている。

そして残りのコードで、購読中のObservableから得られた最新の値 `this._latestValue` をreturnしている。returnされた値が、実際にテンプレートのレンダリングに使われる値になる。

ここからわかることは、**AsyncPipeは **`transform()`**メソッドが呼び出されたときにキャッシュしている **`this._latestValue`** を返している** ということだ。 このことはAsyncPipeの `_subscribe()` メソッドと `this._updateLatestValue()` メソッドを見てもわかる。 `_subscribe()`メソッドで購読した非同期データに値が流れてきたら、そのコールバックで `ChangeDetectorRef` の `markForCheck()` が呼び出される。

```
  private _subscribe(obj: Observable<any>|Promise<any>|EventEmitter<any>): void {
    this._obj = obj;
    this._strategy = this._selectStrategy(obj);
    this._subscription = this._strategy.createSubscription(
        obj, (value: Object) => this._updateLatestValue(obj, value));
  }
  ...
  private _updateLatestValue(async: any, value: Object): void {
    if (async === this._obj) {
      this._latestValue = value;
      this._ref.markForCheck();
    }
  }
```

つまり、AsyncPipeは次のような仕組みでテンプレートをレンダリングしている。

1. Change DetectionでPipeの `transform()` が呼び出される
1. 渡されたObservableの購読を開始する
1. `transform()` が呼び出された時点の `this._latestValue` を 返して終了する
1. Observableが値を流したら `this._latestValue` を更新して Change Detectionをトリガーする（1に戻る）

テンプレートが最終的に同期的な値しかレンダリングできない以上、 `transform()` は同期的な値を返す必要があり、それは `transform()` が呼ばれたタイミングでのスナップショットを返すことしかできないのだ。

ここまでをしっかり理解すると、ある疑問が生まれるはずだ。それは、「購読を開始するタイミングの `transform()` は値を返せないんじゃないか？」ということだ。そしてそれこそがAsyncPipeが抱える最大の課題である「初期値null問題」につながる。

## 初期値null問題

`this._latestValue`はObservableの購読コールバックで値がセットされるのだから、 `transform()` の呼び出し時点ではまだ一度も値がセットされていない。しかし、`transform()`はかならず何かしら値を返さなければならないので、規定の初期値を返すようになっている。 もう一度 AsyncPipeの `transform()` の冒頭を見てみよう。

```
    if (!this._obj) {
      if (obj) {
        this._subscribe(obj);
      }
      this._latestReturnedValue = this._latestValue;
      return this._latestValue;
    }
```

最後の2行で使われている `this._latestValue` は一度も値がセットされていないので、このフィールドの初期値が使われることになる。その値が `null` なのだ。

```
export class AsyncPipe implements OnDestroy, PipeTransform {
  private _latestValue: any = null;
  private _latestReturnedValue: any = null;
```

つまり、AsyncPipeは購読したObservableが最初の値を流す前に、必ず一度 `null` を返すようにできているのだ。もとのObservableが `Observable<State>` だったとしても、 AsyncPipeを通すと `State | null` となってしまう、これを「初期値null問題」と呼んでいる。

この問題は深刻そうに思えるが、実は多くのケースで自動的に回避されている。それはAsyncPipeとよく併用される `*ngIf` と `*ngFor` が、AsyncPipeから返される `null` を無視するようになっているからだ。

次のテンプレートでは、 `source$ | async` が返した値を NgIfディレクティブが評価して、Truthyならレンダリングされるため、 `null` のときは `*ngIf` の内側に入ることはない。

```html
<div *ngIf="source$ | async as state">  {{ state.count }}</div>
```

同様に次のテンプレートでは、 `source$ | async` が返した値を NgForディレクティブが評価して、Falsyなら無視されるため、 `null` のときは `*ngFor` の内側に入ることはない。

```html
<div *ngFor="let item of source$ | async">  {{ item }}</div>
```

- `ngIf` や `ngFor` のような null安全なディレクティブを通してあれば、初期値null問題がアプリケーションに影響を与えることはない。問題はそうではない場合、つまり、子コンポーネントのInputに直接AsyncPipeで値を渡しているケースだ。 次のようなケースで、子コンポーネントは `prop` Inputの型を定義してあるはずだが、そこには `null` が渡される可能性を考慮しなくてはならない。`prop` がgetterやsetterであった場合、値にアクセスしようとして実行時エラーが発生することは容易に想像できる。

```html
<child [prop]="source$ | async"></child>
```

ここまでの話で、簡単なベストプラクティスとして言えることはひとつ。 **AsyncPipeは常にNgIfやNgForによるnull安全なガードを通して利用すべきである**。

## AsyncPipeを置き換える

ここからは後編、上述の課題を抱えたAsyncPipeを置き換えられる新しい非同期データバインディングのあり方を模索する。

なぜAsyncPipeが `null` を返すことになったのか、それはPipeが同期的な値を返す必要があるからである。初期値null問題を解決するにはPipeをやめるしかない。

そこでディレクティブを使ってみようと思う。 `*ngFor` のように、Inputとテンプレートを受け取って、ディレクティブの裁量でテンプレートをレンダリングできるアプローチが、AsyncPipeを置き換えるには最適である。

そこで筆者が実装したのが `*rxSubscribe` ディレクティブだ。実際に動作するサンプルは[こちら](https://stackblitz.com/edit/github-zg4qep)。次のように構造ディレクティブでObservableを購読する。

```html
<div *rxSubscribe="source$; let state">  {{ state.count }}</div>
```

ディレクティブは次のような実装になっている。このディレクティブがおこなうことは、

1. `rxSubscribe` Inputで受け取ったObservableを `ngOnInit` で購読する。
1. Observableが値を流したら、初回はテンプレートをEmbedする（レンダリングする）
1. 2回め以降の値が流れてきたら、contextを更新して `markForCheck` を呼び出す

[https://github.com/lacolaco/ngivy-rx-subscribe-directive/blob/master/src/app/rx-subscribe.directive.ts](https://github.com/lacolaco/ngivy-rx-subscribe-directive/blob/master/src/app/rx-subscribe.directive.ts)

```
@Directive({
  selector: "[rxSubscribe]"
})
export class RxSubscribeDirective<T> implements OnInit, OnDestroy {
  constructor(
    private vcRef: ViewContainerRef,
    private templateRef: TemplateRef<RxSubscribeFromContext<T>>
  ) {}
  @Input("rxSubscribe")
  source$: Observable<T>;

  ngOnInit() {
    let viewRef: EmbeddedViewRef<RxSubscribeFromContext<T>>;
    this.source$.pipe(takeUntil(this.onDestroy$)).subscribe(source => {
      if (!viewRef) {
        viewRef = this.vcRef.createEmbeddedView(this.templateRef, {
          $implicit: source
        });
      } else {
        viewRef.context.$implicit = source;
        viewRef.markForCheck();
      }
    });
  }
}
```

このアプローチであれば、最初に値が流れてくるまではテンプレートは描画されず、値が流れてきたタイミングでだけ再レンダリングをトリガーできる。初期値null問題を解決し、さらに再レンダリングも必要なときだけに絞られるのでCPUにもやさしい。

ちなみに 冒頭のテンプレートでの、 `let state` の `state` の型は、Angular v9のIvy以降ならきっちりと `source$` の型から推論され、 `strictTemplates` フラグが有効ならば `state` の使い方を間違えれば AOTコンパイルでエラーになる。

```html
<div *rxSubscribe="source$; let state">
  {{ state.foo }}  <!-- stateは `foo` を持たないためAOTコンパイルエラーになる -->
</div>
```

AsyncPipeでは初期値null問題によって常に `or null` の推論しかできなかったが、構造ディレクティブのアプローチなら `Observable<T>` に対して 正確に推論できる。

ちなみに、この `*rxSubscribe` ディレクティブは `@soundng/rx-subscribe` というnpmパッケージで公開している。ぜひ使ってみてほしい。

- GitHub [https://github.com/soundng/rx-subscribe](https://github.com/soundng/rx-subscribe) 
- NPM [https://www.npmjs.com/package/@soundng/rx-subscribe](https://www.npmjs.com/package/@soundng/rx-subscribe) 
- Demo [https://stackblitz.com/edit/github-zg4qep-kq9pyw?file=src/app/app.component.html](https://stackblitz.com/edit/github-zg4qep-kq9pyw?file=src%2Fapp%2Fapp.component.html) 

## まとめ

- AsyncPipeには初期値null問題がある
- NgIfやNgForでガードすれば影響はない
- 非同期データを扱うにはPipeの限界がある
- 構造ディレクティブによるアプローチはAsyncPipeの問題を解決できる
- `@soundng/rx-subscribe` へのフィードバック歓迎


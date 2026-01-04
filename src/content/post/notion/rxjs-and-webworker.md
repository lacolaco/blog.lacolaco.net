---
title: 'RxJSによるWeb Workerの抽象化 2つのアプローチ'
slug: 'rxjs-and-webworker'
icon: ''
created_time: '2019-03-26T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
tags:
  - 'RxJS'
  - 'Web Worker'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/RxJS-Web-Worker-2-9e5898a659e043159846fe94baa9a101'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では、[RxJS](https://rxjs.dev/) を使った Web Worker の抽象化を試みます。 なお、記事中で Web Worker あるいは Worker と言ったときに指すのは `new Worker()` で作成する Dedicated Worker のみで、Shared Worker や Service Worker などは対象外です。

## なぜ Web Worker？

Web Worker を使うのに 2 つの目的があります。ひとつは off-the-main-thread とよく言われる、UI メインスレッドとは別の Worker スレッドで並行処理をおこなうことによるパフォーマンス改善です。 そしてもうひとつは、仕様がドラフト段階にある **ES Modules の Worker 対応** を利用した _Module Worker_ によるコード分割です。

https://html.spec.whatwg.org/multipage/workers.html#module-worker-example

ES Modules の Worker 対応は、現在 Chromium ではフラグ付きでサポートされています。

https://www.chromestatus.com/feature/5761300827209728

Module Worker では次のようなコードで `type: 'module'` を指定すると、コンストラクタに指定したパスを ES Module として読み込めます。 さらに Worker スクリプト内でも ES Module のコンテキストで他のモジュールを import/export 文を使えるようになります。

```javascript
const worker = new Worker("./worker.mjs", { type: "module" });
```

もちろん Chrome ですらまだ普通には使えない機能なので、今 Module Worker を使うためには小細工が必要です。 webpack を使っている場合は、Google の Chrome チームが開発している WorkerPlugin を使うのが便利です。

https://github.com/GoogleChromeLabs/worker-plugin

WorkerPlugin は `type: 'module'` オプションで Module Worker を作成しているコードを発見すると、 呼び出されているファイルを webpack の Code Splitting 機能で別バンドルに分割しながら、`type: 'module'` オプションを除去してくれます。

https://webpack.js.org/guides/code-splitting

つまり、このプラグインさえ入れておけば、ES Module ベースで書かれたファイルを Module Worker として呼び出し、webpack のビルド後には Worker ごとにバンドルが自動で分割されている、という状態になります。 多くの場合、Worker で実行したい処理というのはページの初期化時に必要なものではないでしょう。 たいていはユーザーインタラクションや何かのイベントを受けて実行される非同期的なジョブです。 そのような処理は遅延読み込みと Worker の両方と相性がよいので、Module Worker はページの初期読み込みに必要なバンドルサイズを少なくしながらメインスレッド の負荷も下げられるまさに一石二鳥です。

## RxJS による抽象化

Worker は postMessage/ommessage によって他のスレッドとコミュニケーションします。 このイベント駆動の仕組みは、RxJS の Subject モデルとよく似ています。 Worker そのものでは拡張性に乏しいですが、Subject で抽象化することで RxJS のオペレーターを使ったデータ加工や、RxJS と連携できる他の JavaScript ライブラリなどとのコミュニケーションも容易になります。 そして RxJS は元来が非同期処理を扱うためのものですから、そのイベントの由来が同じスレッドか Worker スレッドかは気にせず同じ非同期の枠で考えられます。 このことからも、Worker による別スレッドでの処理とそのイベント購読は RxJS でうまく抽象化できるのではないかと考えています。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20190326/20190326141608.png)

### アプローチ 1. Worker as a Subject

まずひとつめのアプローチとして、Worker そのものが Subject のインターフェースを備えるというアプローチを試みます。 これは Worker スレッドから送られてくるイベントをメインスレッドで購読する形です。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20190326/20190326142344.png)

次のコードは、Worker を隠蔽する `WorkerSubject` の実装例です。 `WorkerSubject` は`next` メソッドで渡されたデータを Worker に postMessage し、 Worker の `message` / `error` イベントを内部の子 Subject で購読します。 `WorkerSubject` を購読する Subscriber は 内部の子 Subject を間接的に購読することになります。 これは実装の一例であって、もっと効率的な実装はあると思います。

```typescript
export class WorkerSubject<T> extends Subject<T> {
  private inner = new ReplaySubject();
  private sub = new Subscription();

  constructor(public worker: Worker) {
    super();
    this.sub.add(
      fromEvent<MessageEvent>(worker, "message").subscribe(ev =>
        this.inner.next(ev.data)
      )
    );
    this.sub.add(
      fromEvent<ErrorEvent>(worker, "error").subscribe(ev =>
        this.inner.error(ev.error)
      )
    );
    this._subscribe = this.inner._subscribe.bind(this.inner);
  }

  next(value: T) {
    this.worker.postMessage(value);
  }

  complete() {
    this.sub.unsubscribe();
    this.inner.complete();
    super.complete();
  }
}
```

具体的な例として、Markdown 文字列を HTML 文字列に変換する処理を Worker スレッドで実行してみます。 まずは次のように `./compile-markdown.ts` を作成します。

Subject に隠蔽するためには、入力に対して出力を返す ping-pong 型の Worker であると好都合です（必ずしもそうでなくてもよいですが）。 `onmessage`で受け取った文字列を変換し、 `postMessage` でレスポンスのイベントを発火しています。

```typescript
import * as marked from "marked";

function compileMarkdown(markdownString: string) {
  return new Promise<string>((resolve, reject) => {
    marked(markdownString, {}, (err, result) => {
      if (err) {
        reject(err);
        return;
      }
      return resolve(result);
    });
  });
}

// [tsconfig] lib: "dom" and "webworker" are exclutive.
const _self: Worker = self as any;

_self.onmessage = ev => {
  compileMarkdown(ev.data)
    .then(result => {
      _self.postMessage(result);
    })
    .catch(err => {
      throw err;
    });
};
```

`const _self: Worker = self as any;` は TypeScript のためのハックです。同じ tsconfig で `dom` と `webworker` の両方をターゲットとすることができない問題があるため、手動で `self` の型をグローバルの `Window` 型ではなく `Worker` 型に補正しています。

あとは Module Worker を作って、 `WorkerSubject` でラップすると使えるようになります。 Angular のコンポーネントで使うと、次のようなコードになります。 結果としてこのコンポーネントのテンプレートには `## foo` が `<h2>foo</h2>` に変換された HTML 文字列が表示されます。

```typescript
@Component({
  selector: "app-root",
  template: `
    <div>{{ compiled$ | async }}</div>
  `
})
export class AppComponent implements OnInit {
  compiled$: Subject<string>;

  constructor() {
    // Module Workerの作成とWorkerSubjectでのラップ
    this.compiled$ = new WorkerSubject(
      new Worker("./compile-markdown", { type: "module" })
    );
  }

  ngOnInit() {
    // WorkerSubjectに新しいデータを送る
    this.compiled$.next("## foo");
  }
}
```

このアプローチのメリットは次のものが考えられます。

- Worker の実装に制約がなく、既存の Worker はほとんど適用可能である
- Module Worker がコード分割する境界としてわかりやすく、ES Module をそのまま Worker 化できるのが簡単
- もともと next/subscribe で Write と Read が非同期的であることから、その内部が Worker を経由していても利用側に影響しない

一方で、Worker 側の実装では postMessage/onmessage を隠蔽できていないという課題もまだあります。

### アプローチ 2. Worker as an Operator

もうひとつのアプローチは、Observable に適用するオペレーターの処理を Worker スレッドに委譲するものです。 Observable の実体や購読者はメインスレッドにあるまま、データ処理の一部分だけの並行性を高められます。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20190326/20190326150102.png)

このアプローチの実装は Worker を関数のように扱うため、Module Worker よりも greenlet によるインライン Worker 化のほうが向いています。 インライン Worker とは、 Data URI を使って作成される Worker のことを指しています。 greenlet は、Promise を返す非同期関数を実行時にインライン Worker に変換して Worker スレッドで実行するライブラリです。

https://github.com/developit/greenlet

RxJS のオペレーターで、関数を渡して処理をおこなう代表的なものは `map` 系のものでしょう。 どのオペレーターにも適用できますが、ここでは `map` オペレーターを Worker 化した `mapOnWorker` オペレーターを実装してみます。

RxJS のオペレーターの実体は Observable を受け取って Observable を返す関数です。 `mapOnWorker` は次のように簡単に実装できます。

```typescript
import gleenlet from "greenlet";
import { from, Observable } from "rxjs";
import { concatMap } from "rxjs/operators";

export function mapOnWorker<T, U>(fn: (arg: T) => Promise<U>) {
  // 関数をインラインWorker化する
  const workerized = gleenlet(fn);
  return (source: Observable<T>): Observable<U> => {
    // 1. `workerized`関数を呼び出す
    // 2. 戻り値のPromiseを `from` 関数でObservableに変換する
    // 3. `concatMap` オペレーターで元のObservableと結合する
    return source.pipe(concatMap(v => from(workerized(v))));
  };
}
```

`map` オペレーターと同じように順序を守るために `concatMap` を使いましたが、`mergeMap` や `switchMap` のようなオペレーターを使うものも簡単に作れます。

```typescript
export const mapOnWorker = concatMapOnWorker;

export function concatMapOnWorker<T, U>(fn: (arg: T) => Promise<U>) {
  const workerized = gleenlet(fn);
  return (source: Observable<T>): Observable<U> => {
    return source.pipe(concatMap(v => from(workerized(v))));
  };
}

export function switchMapOnWorker<T, U>(fn: (arg: T) => Promise<U>) {
  const workerized = gleenlet(fn);
  return (source: Observable<T>): Observable<U> => {
    return source.pipe(switchMap(v => from(workerized(v))));
  };
}

export function exhaustMapOnWorker<T, U>(fn: (arg: T) => Promise<U>) {
  const workerized = gleenlet(fn);
  return (source: Observable<T>): Observable<U> => {
    return source.pipe(exhaustMap(v => from(workerized(v))));
  };
}
```

Worker への関心はオペレーターの内部に完全に閉じているので、オペレーターの利用側は他のオペレーターと同じようにただ `pipe` メソッドに渡すだけです。

```typescript
import { interval, Observable } from "rxjs";
import { mapOnWorker } from "../lib/mapOnWorker";

@Component({
  selector: "app-root",
  template: `
    <div>{{ calculated$ | async }}</div>
  `
})
export class AppComponent implements OnInit {
  calculated$: Observable<any>;

  constructor() {
    // 1msごとに発火するObservable
    this.calculated$ = interval(1).pipe(
      // Workerで計算処理を実行する
      mapOnWorker(async i => Math.sqrt(i))
    );
  }
}
```

このアプローチのメリットは、オペレーター利用側にまったく関心を漏らさずに CPU 負荷の大きいオペレーター処理を Worker スレッドに逃がせるところです。 上記の例では非同期化するまでもない処理ですが、文字列の全文検索だったりパターンマッチだったり、メインスレッドをブロックしうる計算処理が Observable のオペレーターにあるときには有効です。

デメリットはオペレーターの呼び出しのたびにかかるインライン Worker とのコミュニケーションのコストです。 Worker スレッドで実行する処理があまり時間のかからないものであれば、オーバーヘッドが相対的に高く付くこともあるかもしれません。

## まとめ

この記事では Web Worker を意識せずに Web Worker の恩恵を受けられるように RxJS を使って抽象化するアプローチを紹介しました。 Promise を使ってクラスや関数を Worker 化するアプローチは Google Chrome チームの Comlink や Cloony がとてもクールです。 しかし複数回発行するイベントを扱うにはどうしても Observable のようなモデルが必要だと思います。

https://github.com/GoogleChromeLabs/comlink

https://github.com/GoogleChromeLabs/clooney

サンプルコードは GitHub 上で公開しています。 コード例はどれも完璧である保証はなく、もっと効率的な実装があるかもしれませんので、ご利用は自由ですが自己責任でよろしくおねがいします。

https://github.com/lacolaco/rxjs-worker-sandbox


---
title: 状態管理のライブラリを作りました
date: "2018-01-12T12:17:16.472Z"
tags: [typescript, library, oss]
---

TypeScript/JavaScript 用に状態管理のライブラリを作りました。

https://www.npmjs.com/package/@lacolaco/reactive-store

広く使ってもらうためというよりは、自分のアプリケーションで何度も同じコードを書きたくないのがライブラリ化のモチベーションです。

### Inspired by repatch and ngrx/store

lacolaco/reactive-store の設計は[repatch](https://github.com/jaystack/repatch/)と[ngrx/store](https://github.com/ngrx/platform/blob/master/docs/store/README.md)に影響を受けています。Angular でアプリケーションを書くことが多いので、RxJS フレンドリーなストアとして ngrx/store を使っていましたが、2 つの不満な点がありました。

- 現在の状態のスナップショットが取れない（非同期 API しか存在しない）
- Action と Reducer が冗長

代わりになるストアのライブラリを探したところ、repatch は自分がほしいものにとても近かったのですが、RxJS の Observable と互換性がないことと、subscribe できる単位がストア全体という部分が不満で、結局自分で作ることにしました。

```ts
import { Store } from "@lacolaco/reactive-store";

const store: Store<string> = new Store("initialState");

store.getValue(); //=> 'initialState';
store.subscribe(state => {});
store.patch(state => "updated!");
```

lacolaco/reactive-store の実装は型定義を除くと 30 行程度で、ほとんどは RxJS の BehaviorSubject の機能をそのまま使っています。追加したのは patch メソッドと select メソッドと Middleware です。

#### store.patch((state: T ) => T)

現在の状態から新しい状態を作る関数を渡します。Redux 的な文脈で言えば Reducer と似ています。repatch に影響を受けています。

#### store.select((state: T) => any)

ストアが管理している状態のいち部分だけの Observable を作るためのメソッドです。具体的には map して distinctUntilChanged した結果を返します。ngrx/store に影響を受けています。

```ts
import { Store } from "@lacolaco/reactive-store";

const store: Store<{ count: number }> = new Store({ count: 0 });

const count$: Observable<number> = store.select(state => state.count);
count$.subscribe(count => {
  console.log(count);
});

store.patch(state => {
  return {
    count: state.count + 1
  };
});
```

#### Middleware

Middleware は dispatch メソッドに介入する仕組みです。lacolaco/reactive-store では dispatch された新しい状態を Observable に流す一番基本の部分も Middleware と同列に扱われています。実装の参考になったのは Angular の HttpInterceptor です。

まず Middleware の前に、state を受け取り何かを返す関数として `StateHandler` という型があります。

```ts
export type StateHandler = (state: any) => any;
```

そして Middleware は、StateHandler を受け取り StateHandler を返す関数です。

```ts
export type Middleware = (next: StateHandler) => StateHandler;
```

何もしない Middleware は次のように書けます。

```ts
const noopMiddleware = next => state => next(state);
```

大した実装ではないので詳しくは[ソースコード](https://github.com/lacolaco/reactive-store#readme)を読んで下さい。ユニットテストも書いてあります。具体的なユースケースとしては Logging などが考えられます。次の例ではすべての StateHandler が処理を終えたあとに、新しい state をコンソールに書き出しています。

```ts
import { Store } from "@lacolaco/reactive-store";

const loggingMiddleware = next => {
  return state => {
    const newState = next(state);
    console.log(`[State]`, newState);
    return newState;
  };
};

const store = new Store(0, [loggingMiddleware]);
```

### 利点

- 実装が薄いので RxJS さえ信用できれば安心して使える
- RxJS のエコシステムと簡単に接続できる
- 型安全

もし興味があれば使ってみて Issue とかツイッターでフィードバックとかもらえるとうれしいです。

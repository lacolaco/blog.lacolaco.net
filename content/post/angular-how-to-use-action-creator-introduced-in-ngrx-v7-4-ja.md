---
title: "NgRx v7.4で導入されるAction Creatorの使い方"
date: 2019-04-03T22:33:47+09:00
tags: [Angular, NgRx, TypeScript]
---


この記事では NgRx v7.4で導入される **Action Creator** 機能と、それを使った実装パターンを紹介します。
Action Creatorはまだ [ngrx.io](https://ngrx.io) のドキュメンテーションに含まれていませんが、将来的に追加された後はそちらを参照するようにしてください。

## アクションの定義

簡単なカウンターを実装しながら、これまでのNgRxの書き方をおさらいしましょう。
今回のカウンターは、任意の数値を受け取って加算する `Increment` と、カウンターをリセットする `Reset` をアクションとして定義します。

これまでのアクション定義では、アクションタイプのEnum と、それを持つ各アクションクラス、そしてそのクラス型のUnion Typeを定義するのが一般的でした。
たとえば `Increment` と `Reset` というアクションとする `counter.actions.ts` を定義すると次のようになります。
`Increment` は与えられた数だけカウントを進め、 `Reset` は カウントを 0 に戻すためのアクションです。

```typescript
// counter.actions.ts
import { Action } from '@ngrx/store';

export enum ActionTypes {
  Increment = '[Counter] Increment',
  Reset = '[Counter] Reset',
}

export class Increment implements Action {
  readonly type = ActionTypes.Increment;

  constructor(public payload: number) { }
}

export class Reset implements Action {
  readonly type = ActionTypes.Reset;
}

export type ActionsUnion = Increment | Reset;
```

このファイルはAction Creatorによって次のように書き換えられます。

```typescript
// counter.actions.ts
import { createAction, union } from '@ngrx/store';

export const increment = createAction(
  '[Counter] Increment',
  (payload: number) => ({ payload })
);

export const reset = createAction(
  '[Counter] Reset'
);

const actions = union({
  increment,
  reset,
});

export type ActionsUnion = typeof actions;
```

### `createAction` 関数

まずクラス定義を置き換えている `createAction` 関数について解説します。
この関数は Action Creatorを返します。Action Creatorはアクションオブジェクトを返す関数です。
つまり、ディスパッチするアクションが、クラスをnewしたインスタンスから関数の戻り値に変わります。

```typescript
import * as Actions from './actions';

// アクションクラスのインスタンス
store.dispatch(new Actions.Increment(1));

// Action Creator
// 関数がActionを返す
store.dispatch(Actions.increment(1));
```

引数を取るアクションは、 `createAction` 関数の第2引数に関数を渡します。
この関数は任意の引数を取り、任意のオブジェクトを返します。
これは従来のアクションクラスにおけるコンストラクタとクラスフィールドの定義と同じです。

`increment` アクションをもう一度見てみましょう。
第2引数は数値を `payload` 引数として受け取る関数で、戻り値は `payload` プロパティをもつオブジェクトです。。
この関数の戻り値は第1引数から作られるアクションオブジェクトとマージされ、 最終的に `{ type: '[Counter] Increment'', payload }` というアクションオブジェクトを作成することになります。

```typescript
// アクションを作成する
const action = Actions.increment(1);

// アクションオブジェクトは `type` を持つ
console.log(action.type); // => '[Counter] Increment'
// 第2引数で返したオブジェクトがマージされている
console.log(action.payload); // => 1
```

ちなみに、これまで Enumで管理していたアクションタイプの文字列は、これまではクラスインスタンスを作らないと `type` が手に入らないためにクラスと別にEnumを置いていましたが、
今後は `increment.type` という形でアクセスできるため、いちいちEnumを作る必要はありません。
これについては後述する Reducerの変更部分で詳しくわかります。

### `union` 関数

一連のアクションの型を合成した`ActionsUnion` 型は、ReducerやEffectなどいくつかの場所で必要となります。
従来のアクションクラスでは、クラス型の Union Type をそのまま扱えたが、関数の場合はその関数の戻り値の型を合成する必要があります。
それを補助してくれるのが NgRxの `union` 関数です。

すべてのAction Creatorを `union` 関数に渡し、その戻り値を **エクスポートせず** 宣言します。
なぜエクスポートしないかというと、欲しいのはその型だけだからでです。エクスポートして外部から参照可能にしたところで使いみちはありません。
`actions` 変数を宣言したら、`typeof` を使ってその型を `Union` 型として外部にエクスポートします。

```typescript
// 戻り値はエクスポートしない
const actions = union({
  increment,
  reset,
});

// 型だけエクスポートする
export type ActionsUnion = typeof actions;
```

## Reducerの作成

Action Creatorを定義したら、次はReducerを対応させます。
もともとアクションクラスとEnumを使っていたときは、次のような Reducerになっていました。
引数に渡されるアクションの型は `ActionsUnion` 型で、 `action.type` を `ActionTypes` のEnum文字列と照らし合わせるswitch文を記述します。

```typescript
import { ActionsUnion, ActionTypes } from './actions';
import { State, initialState } from './state';

export function reducer(state = initialState, action: ActionsUnion): State {
  switch (action.type) {
    case ActionTypes.Increment: {
      return {
        ...state,
        count: state.count + action.payload,
      };
    }
    case ActionTypes.Reset: {
      return {
        ...state,
        count: 0,
      };
    }
    default: {
      return state;
    }
  }
}
```

このReducerに先ほどの アクション定義の変更を反映すると、次のようになります。
変わったのはcase文だけです。
case文で指定するアクションタイプは、Action Creatorがもつ `type` プロパティに変わりました。
このように Action Creatorから直接取得できるため、アクション定義側でEnumに分離する必要がなくなっています。

```typescript
import { ActionsUnion, increment, reset} from './actions';
import { State, initialState } from './state';

export function reducer(state = initialState, action: ActionsUnion): State {
  switch (action.type) {
    case increment.type: {
      return {
        ...state,
        count: state.count + action.payload,
      };
    }
    case reset.type: {
      return {
        ...state,
        count: 0,
      };
    }
    default: {
      return state;
    }
  }
}
```

## Effectsの作成

NgRxのEffectsを使って、カウンターの加算とリセットがおこなわれるたびにログを出力する副作用を定義します。
従来のアクション定義では次のようになります。

```typescript
import { Injectable } from '@angular/core';
import { Effect, Actions, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';

import { ActionsUnion, ActionTypes } from './actions';

@Injectable()
export class CounterEffects {

  constructor(private actions$: Actions<ActionsUnion>) { }

  @Effect({ dispatch: false })
  logger$ = this.actions$.pipe(
    ofType(ActionTypes.Increment, ActionTypes.Reset),
    tap(action => {
      console.log(action);
    }),
  )
}
```

これも Reducerと同じように、アクションタイプの部分だけに影響があります。

```typescript
import { Injectable } from '@angular/core';
import { Effect, Actions, ofType } from '@ngrx/effects';
import { tap } from 'rxjs/operators';

import { ActionsUnion, increment, reset } from './actions';

@Injectable()
export class CounterEffects {

  constructor(private actions$: Actions<ActionsUnion>) { }

  @Effect({ dispatch: false })
  logger$ = this.actions$.pipe(
    ofType(increment.type, reset.type),
    tap(action => {
      console.log(action);
    }),
  )
}
```

## アクションのディスパッチ

最後にアクションをディスパッチする部分です。
従来のアクションクラスでは、クラスインスタンスを生成して次のようにディスパッチしていました。

```typescript
import * as CounterActions from './state/counter/actions';

@Component({
  selector: 'my-app',
  template: `
     <div>{{ count$ | async }}</div>
     <button (click)="incrementOne()">+1</button>
     <button (click)="reset()">Reset</button>
  `,
})
export class AppComponent {

  count$ = this.store.pipe(
    select(state => state.counter.count),
  );

  constructor(private store: Store<AppState>) { }

  incrementOne() {
    this.store.dispatch(new CounterActions.Increment(1));
  }

  reset() {
    this.store.dispatch(new CounterActions.Reset());
  }
}
```

これはすでに説明したとおり、Action Creatorの関数を呼び出した戻り値をディスパッチするように変わります。

```typescript
import * as CounterActions from './state/counter/actions';

@Component({
  selector: 'my-app',
  template: `
     <div>{{ count$ | async }}</div>
     <button (click)="incrementOne()">+1</button>
     <button (click)="reset()">Reset</button>
  `,
})
export class AppComponent {

  count$ = this.store.pipe(
    select(state => state.counter.count),
  );

  constructor(private store: Store<AppState>) { }

  incrementOne() {
    this.store.dispatch(CounterActions.increment(1));
  }

  reset() {
    this.store.dispatch(CounterActions.reset());
  }
}
```

これですべての置き換えが終わりました。

## Action Creatorのメリット

クラスで定義されるアクションは、インスタンスを作るまで `type` にアクセスできない不便さや、形式的に書かなければならないコードの量が多かったのが課題でした。

Action Creatorでは関数で記述できるので、無駄なコードが大きく減ります。
そして機能やテスタビリティは以前と変わらず、特にデメリットはありません。

プロジェクトのNgRxをv7.4にアップデートしたら、基本的にはAction Creatorへの置き換えを進めるべきです。

## まとめ

* アクションをクラスではなく関数で定義する Action Creator を作る `createAction` 関数が導入された
* ActionTypeのEnumはもう必要ない
* ReducerやEffects、ディスパッチ側への影響はとても軽微

この記事で扱ったカウンターアプリケーションが実際に動作する様子を確認してみてください。

https://stackblitz.com/edit/angular-pj4f4p?file=src%2Fapp%2Fapp.component.ts

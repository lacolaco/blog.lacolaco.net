---
title: Learn NgRx
date: 2019-02-11T07:37:00.000Z
tags: [ngrx]
---

Redux そのものについては理解しているため、NgRx における一般的な設計の理解と、ベストプラクティスの模索を目的とした学習をする。

## Basic

ドキュメンテーション [https://ngrx.io](https://ngrx.io)

Install: [https://ngrx.io/guide/store/install](https://ngrx.io/guide/store/install)

## Playground

学習にあたり、公式チュートリアルの最後の状態から NgRx を導入して試してみた。

[lacolaco/ngrx-toh-example](https://github.com/lacolaco/ngrx-toh-example)

## Architecture

### RootStore / FeatureStore

`StoreModule.forRoot()` で登録される reducer はアプリケーショングローバルな AppState を管理するもの

`StoreModule.forFeature()` で Feature ごとに分割された FeatureState を管理できる

AppState は内部的には単一オブジェクトとして管理されるものの、FeatureState にわけることで関心の外にある状態を無視することが明示的になり、さらに Selector のメモ化もあいまって関心のある状態だけに明確に依存することができる。 `forFeature` が呼び出されるたびに Root の State が extend される仕組みなので、 Feature 側から Root 側の状態にアクセスできる。Lazy Load されたあと Root 側の状態に依存できる。

当然だが、FeatureState は Feature Module と同じスコープで語られるべきである。1 Page : 1 Feature の設計になる場合もあるが、同じ Feature に依存する複数の Pages をグループ化することで Feature Module の範囲が決まる、という State → Feature の方向での設計も可能であろう。また、Root の AppState は Route に依存しない大域の State という位置づけもわかりやすくなる。いずれにせよ、Angular のアプリケーション設計において Feature Module の粒度が重要な軸となるのは明らかだ。

    {
      "global": {
      },
      "hero": {
        "heroes": [],
        "selectedHero": null
      }
    }

このような State Tree を意識する場合は、 `hero` Feature が単位となり、 HeroDetailPage や HeroListPage はこの HeroFeature の一員になるはず。ただし HeroDetail が持つ情報が大きくなってくるなら、 HeroList Feature と HeroDetail Feature は分離されることもあり得る。State Tree のネストの深さに一定の規約を設けると良いかもしれない。基本的にネストが深くて嬉しいことはない。

RoutingModule の慣習に従い、FeatureModule と FeatureStoreModule は分離する。

HeroModule / HeroRoutingModule / HeroStoreModule が並ぶ形だ。

    // ducks pattern
    // src/app/hero/hero.{reducer,actions,effects,selectors}.ts

    import { ActionTypes, Actions } from './hero.actions.ts';

    export type State = {
      heroes: Hero[];
    	selectedHero: Hero | null;
    }

    export const initialState: State = {
      heroes: [],
      selectedHero : null,
    }

    export function reducer(state: State = initialState, action: Actions) {
      switch (action.type) {
        case ActionTypes.SELECT_HERO:
          return { ...state, selectedHero: action.payload };
      }
      return state;
    }

    // src/app/hero/hero-store.module.ts
    import { reducer } from './hero.reducers.ts'

    @NgModule({
      imports:[ StoreModule.forFeature('hero', reducer)]
    })
    export class HeroStoreModule {}


    // src/app/hero/hero.module.ts
    @NgModule({
      imports: [
        HeroRoutingModule,
        HeroStoreModule,
      ]
    })
    export class HeroModule {}

AppStore に追加すべき State がどのようなものか、言語がしにくい部分があるが、 Router Store や、その他アプリケーションから少し外に関心がある状態は AppStore にあるほうが都合がいいかもしれない。ただし定数を State にしないように気をつけたい。

### Effects について

https://ngrx.io/guide/effects

Effects で定義される `Effect` とは Action を受け取り Action を返す Observable のことである。まれに Action を受け取らないものもあるし、まれに Action を返さないもの(`dispatch: false` ) もある。

いわゆる**副作用**を記述するものだが、Effects の発表直後からそのベストプラクティスは変わってきている。第一に、**API コールは副作用ではない。**ということだ。主作用があって初めて副作用がある。NgRx を使った設計においては、主作用を Facade が担い、その主作用の副作用として起きる変化を Effects で定義するのがよい。 主作用とは次の流れだ。

1. Component が Facade を呼び出す
2. Facade が現在の State を使い Service を呼び出す。その結果を Action として dispatch する
3. reducer が State を書き換える
4. Component に新しい State が届く

ここで 2 の Action が何か別の作用を生み出す必要があるとき、それは副作用と呼ばれ、 Effects を使って記述する。副作用を起こすためだけの Action をわざわざ作る必要はない。reducer から参照されていない Action がある時点で、それは副作用として主作用を書いているのだ。Action は Reducer で主作用になることを前提とする。

Effects を何のために使うべきで、何のために使わざるべきかについては、次の 2 つの記事が非常に明快だった。

[Start using ngrx/effects for this - Angular In Depth](https://blog.angularindepth.com/start-using-ngrx-effects-for-this-e0b2bd9da165)

[Stop using ngrx/effects for that - Michael Pearson - Medium](https://medium.com/@m3po22/stop-using-ngrx-effects-for-that-a6ccfe186399)

Effects を使うとかえって複雑度が高まるものは素の RxJS を使ったほうがよい。そして、RxJS にすることですら複雑度が高まってしまうものは、素の Promise で書いてしまうほうがよい。ライブラリは楽になるために使うべきだ。

Facade についての参考リンク

[NgRx + Facades: Better State Management - Thomas Burleson - Medium](https://medium.com/@thomasburleson_11450/ngrx-facades-better-state-management-82a04b9a1e39)

[NgRx Facades: Pros and Cons](https://auth0.com/blog/ngrx-facades-pros-and-cons/)

これらの例では Facade は Action を投げているだけだが、僕の考えではここに Service を Inject して API コールをしてもよい。async/await で API コールを行い、その結果を Action として dispatch するとよい。Fetching の状態が必要なら、 `BEGIN_FETCHING_USERS` action を投げれば良い。 `GET_USERS` action を Effects で処理するのは複雑度を無駄に上げている。

ちなみに、この Facade を Component と 1:1 になるように作ると、BLoC と呼ばれるものに近づいてくる。

### RouterStore について

https://ngrx.io/guide/router-store

RouterStore は Effects で真価が発揮される。RouterStore を使わない場合、Angular Router の ActivatedRoute から情報を取得し、Action を発行し、コンポーネントの状態に組み込むことになる。RouterStore があれば、Router Actions の副作用として Action を発行し、その結果を State に書き込むことでコンポーネント側へデータが届く。

**ActivatedRoute ⇒ Component ⇒ Action ⇒ State ⇒ Component**

Router Action ⇒ Effects ⇒ Action ⇒ **State ⇒ Component**

Component はまったく Router や UrlTree のことを知らなくてよくなる。ActivatedRoute への依存を持つ必要がなくなり、テスタビリティも向上する。RouterStore は内部的に Router の状態を `router` Feature に更新し続けてくれる仕組みなので、テストの際は Router に依存する必要はなく、自分で `router` 以下の State を設定すればいい。

逆に言えば、Effects を投入しないのなら Router Store を使う意味はそれほどない気もする。しかし ActivatedRoute の少し使いづらい部分（Inject する Component の階層により得られる Route の情報が変わる（UrlTree のどこに該当するか）部分は、Router Store で常に root から読むこととすれば一貫性のあるアクセスはできるだろう。

## 参考リンク

[Sharing data between modules is peanuts. - Angular In Depth](https://blog.angularindepth.com/sharing-data-between-modules-is-peanuts-3f40fcb38dd)

[NgRx Refactoring Patterns enhanced with ngrx-ducks](https://speakerdeck.com/gregonnet/ngrx-refactoring-patterns-enhanced-with-ngrx-ducks)

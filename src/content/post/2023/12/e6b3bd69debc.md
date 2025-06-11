---
title: '【Angular個別コミット解説】feat(router): Add info property to NavigationExtras'
slug: 'e6b3bd69debc'
icon: ''
created_time: '2023-12-06T23:53:00.000Z'
last_edited_time: '2025-06-11T08:39:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-feat-router-Add-info-property-to-NavigationExtras-d0a077fb608b42d7ad5232bbb9c37d0d'
features:
  katex: false
  mermaid: false
  tweet: false
---

Routerに面白い変更が入ったので、このコミットの個別解説をする。順当に行けばAngular v17.1.0で利用可能になる。

https://github.com/angular/angular/commit/5c1d4410298e20cb03d7a1ddf7931538b6a181b4

## コミットメッセージ

> This commit adds a property to the navigation options to allow developers to provide transient navigation info that is available for the duration of the navigation. This information can be retrieved at any time with `Router.getCurrentNavigation()!.extras.info`. Previously, developers were forced to either create a service to hold information like this or put it on the `state` object, which gets persisted to the session history.

_このコミットでは、ナビゲーションオプションにプロパティを追加して、開発者がナビゲーションの間利用可能な一時的なナビゲーション情報を提供できるようにしました。この情報は、**`Router.getCurrentNavigation()!.extras.info`**でいつでも取得することができます。以前は、このような情報を保持するためにサービスを作成するか、**`state`**オブジェクトに配置する必要がありましたが、これはセッション履歴に永続化されるものです。_

> This feature was partially motivated by the [Navigation API](https://github.com/WICG/navigation-api#example-using-info) and would be something we would want/need to have feature parity if/when the Router supports managing navigations with that instead of `History`.

_この機能は、**[Navigation API](https://github.com/WICG/navigation-api#example-using-info)**に部分的に触発されたものであり、もしルーターが**`History`**の代わりにNavigation APIによるナビゲーション管理をサポートする場合には、機能の平等性を維持するために必要なものです。_

Routerの `navigate()` メソッドや `routerLink` ディレクティブでナビゲーションをおこなう際に、そのナビゲーションに紐づく付加情報を保持するための `info` プロパティが使えるようになる。この情報はナビゲーションの間にだけ利用可能であることが重要であり、その点でブラウザの履歴に永続化される `state` プロパティと対比されている。

## APIの概要

このAPIがどのように使われるのかはテストコードからわかる。次のテストコードでは、 `router.navigateByUrl()` メソッドの第二引数で渡した `{info: 'navigation info'}` という値を、Routerの `getCurrentNavigation()?.extras?.info` から取り出している。

```ts
it('should set transient navigation info', async () => {
  let observedInfo: unknown;
  const router = TestBed.inject(Router);
  router.resetConfig([
    {
      path: 'simple',
      component: SimpleCmp,
      canActivate: [
        () => {
          observedInfo = coreInject(Router).getCurrentNavigation()?.extras?.info;
          return true;
        },
      ],
    },
  ]);

  await router.navigateByUrl('/simple', { info: 'navigation info' });
  expect(observedInfo).toEqual('navigation info');
});
```

これでこの変更のだいたいの雰囲気はわかるだろう。

## モチベーション

このプロパティ追加がなぜ必要とされるのか、そのモチベーションは `info` プロパティのコード内ドキュメントで詳しく書かれている。

> Use this to convey transient information about this particular navigation, such as how it happened. In this way, it's different from the persisted value `state` that will be set to `history.state`. This object is assigned directly to the Router's current `Navigation` (it is not copied or cloned), so it should be mutated with caution.

One example of how this might be used is to trigger different single-page navigation animations depending on how a certain route was reached. For example, consider a photo gallery app, where you can reach the same photo URL and state via various routes:

- Clicking on it in a gallery view
- Clicking
- "next" or "previous" when viewing another photo in the album
- Etc.

Each of these wants a different animation at navigate time. This information doesn't make sense to store in the persistent URL or history entry state, but it's still important to communicate from the rest of the application, into the router.

This information could be used in coordination with the View Transitions feature and the `onViewTransitionCreated` callback. The information might be used in the callback to set classes on the document in order to control the transition animations and remove the classes when the transition has finished animating.

要点をまとめるとこうだ。

- `info` プロパティは、特定のナビゲーションに関する一時的な情報を伝達するために使われる。この点で、ブラウザの `history.state` にセットされる永続的な値である `state` プロパティと区別される。このオブジェクトはRouterのその時点の `Navigation` に（コピーやクローンではなく）参照が直接割り当てられるため、変更には注意する必要がある。
- この機能のユースケースのひとつは、特定のルートに到達した方法に応じて異なる単一ページのナビゲーションアニメーションをトリガーすることだ。たとえば写真のギャラリーアプリであれば、同じURLであっても、それがギャラリーから選択された場合と別の写真から前後に移動した場合がありえる。それぞれのナビゲーションに異なるアニメーションを適用するために、ブラウザ履歴に永続化する必要のない一時的な情報が重要になる。
- `info` プロパティの情報は、View Transitions機能と `onViewTransitionCreated` コールバックとの連携で使用できる。例えば、このコールバックでドキュメントにクラスを設定してトランジションアニメーションを制御し、トランジションがアニメーション化が終了した時にクラスを削除するのに利用できる。

以上のコメントから、この `info` プロパティはあるページから別のページに向けた状態の伝達のためのAPIではないことがわかる。この情報はあくまでもナビゲーション中に使うものであって、ナビゲートされた先のコンポーネントで使うものではない。そういう状態管理のユースケースは今まで通りのやり方から変える必要はない。

このAPIは特にナビゲーションに連動するアニメーションの制御を主眼としているようだ。最後に書かれている例に沿うと、Angular v17でサポートされたRouterの `withViewTransitions()` 機能と併用するのは以下のようなコードになるだろう。

```ts
bootstrapApplication(App, {
  providers: [
    provideRouter(
      routes,
      withViewTransitions({
        onViewTransitionCreated: (vt) => {
          const info = inject(Router).getCurrentNavigation()?.extras?.info;
          // info によるなんらかの条件分岐
          if (...) {
            // トランジション開始前にクラスを付与してアニメーションを差し替える
            document.documentElement.classList.add('foobar');
            // トランジションが終わったら付与したクラスを外す
            vt.transition.finished.then(() => {
              document.documentElement.classList.remove('foobar');
            });
          }
        },
      })
    ),
  ],
});
```

とはいえまだView Transitions APIは利用可能なブラウザが限られているため、かなり先を見越した先行投資的な機能追加だと言える。

## コードの変更

最後に、この機能追加のために加えられているライブラリのコード変更を見てみよう。まずは `NavigationBehaviorOptions` 型にプロパティが追加されている。この`NavigationBehaviorOptions` 型は、Routerの `navigate()` メソッドや `navigateByUrl()` メソッドの第二引数の型である。

```diff
// @public
  export interface NavigationBehaviorOptions {
+   readonly info?: unknown;
    onSameUrlNavigation?: OnSameUrlNavigation;
    replaceUrl?: boolean;
    skipLocationChange?: boolean;
```

次に、Routerのナビゲート処理の中で、引数に渡された `info` プロパティの値をナビゲーションオブジェクトの付加情報 (`extras` ）にアサインし直している。ここがコピーではなく直接のアサインであると注記されていた部分だ。

```diff
  const mergedTree =
      this.urlHandlingStrategy.merge(e.url, currentTransition.currentRawUrl);
  const extras = {
    // Persist transient navigation info from the original navigation request.
+   info: currentTransition.extras.info,
    skipLocationChange: currentTransition.extras.skipLocationChange,
    // The URL is already updated at this point if we have 'eager' URL
    // updates or if the navigation was triggered by the browser (back
```

実装は以上である。 `info` プロパティはあくまでも情報を伝達するだけの役割で、どのような情報を伝達するか、それをどう使うかはアプリケーション開発者に委ねられている。その性質上、 `info` プロパティは `unknown` 型にしかなりえないし、この情報をアプリケーションの根幹の状態管理に利用するのは絶対にやめたほうがいいだろう。

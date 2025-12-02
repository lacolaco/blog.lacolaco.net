---
title: '[Angular 4.0] router/http/animationsモジュールの更新について'
slug: 'ng4-feature-libs-update'
icon: ''
created_time: '2017-03-13T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-4-0-router-http-animations-aa3078a5d0bb4538aa415008ca903a52'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular 4.0特集のラストはrouterモジュール、httpモジュールの変更と、新たに追加されたanimationsモジュールについての解説です。

## routerモジュールの変更

### イベントの追加

`Router`が発火するイベントに、Lazy Loading用の`RouteConfigLoadStart`と`RouteConfigLoadEnd`が追加されました。 `RouterModule.forChild()`で遅延して読み込まれた設定をRouterに取り込みはじめた時と、それが終わった時に発火されます。

### `runGuardsAndResolvers`設定の追加

`Route`に新しく`runGuardsAndResolvers`プロパティが追加されました。 これは同じルートが選択されているときに、GuardやResolverが再実行するタイミングを制御するためのものです。

`runGuardsAndResolvers`が取り得る値は `paramsChange`、`paramsOrQueryParamsChange`そして`always`の3種類です。 `paramsChange`はデフォルトの設定で、これまでの挙動と同じです。 GuardとResolverが再実行するのはパスパラメータかマトリクスパラメータが変わったときだけです。 `paramsOrQueryParamsChange`では、デフォルトの挙動に加えてクエリパラメータの変更時にも再実行されます。 そして`always`ではあらゆるナビゲーションで再実行されます。

`runGuardsAndResolvers`は次のように設定します。

```
{
    path: 'admin',
    component: AdminCmp,
    runGuardsAndResolvers: 'paramsChange',
    canActivate: [AdminAuth]
},
```

## httpモジュールの変更

### リクエストオプションの`search`が非推奨に

`RequestOptions`型の`search`プロパティが非推奨のAPIとなります。 このプロパティはリクエストURLにクエリパラメータを付与するためのものでしたが、今後は新しく追加される`params`プロパティを使います。

次のコードを見ればとても使いやすくなることがわかります。

```
// Before
const search = new URLSearchParams();
search.append('id', 'foo');
search.append('name', 'bar');

this.http.get(url, {search});

// After
this.http.get(url, {params: {id: 'foo', name: 'bar'}});
```

これまで`search`プロパティが受け取るオブジェクトの型は`string|URLSearchParams`でしたが、 4.0以降はこれに加えて`{[key: string]: any|any[]}`型のマップオブジェクトを受け取ることができます。 `params`プロパティも同じ型のオブジェクトを受け取れます。 内部的には`params`をパースして内部の`search`プロパティを組み立てる、という処理になっているので、 4.x系の間は破壊的変更を防ぐためにどちらのプロパティも同じ挙動で動作しますが、 5.0からは`search`プロパティは外部からは見えないようになります。

## animationsモジュール

animationsモジュールはこれまでcoreモジュールに同梱されていたアニメーションAPIを、独立したモジュールに分割したものです。 アニメーションを必要としないアプリケーションが不要なコードを含まないようにすることを目的としています。

また、animationsモジュールはさらに便利になる新しいAPIがいくつも開発中です。 まだ4.0ではリリースされませんが、ひとつだけ4.0に含まれる変更があるので紹介します。

### transition式の関数サポート

`transition`の第1引数はこれまで文字列で`hide => show`や`* => void`など定義していましたが、 これに加えて`fromState`と`toState`を受け取って`boolean`を返す関数を渡せるようになります。 次のコード例を見てください。

```
transition('hide => show', ...)
// equivalent to
const hide2show = (from, to) => from === 'hide' && to === 'show';
transition(hide2show, ...)

transition('void => *', ...)
// equivalent to
const fromVoid = (from, to) => from === 'void';
transition(fromVoid, ...)
```

## まとめ

- Lazy Loadingのサポート強化
- Guard/Resolveがさらに便利に
- Httpの`search`が非推奨に
- animationsモジュールの追加

---

**Angular 4.0 Features**

- [新しいngIfの使い方](/post/ng4-feature-ngif/)
- [Metaサービスの使い方](/post/ng4-feature-meta-service/)
- [formsモジュールの更新について](/post/ng4-feature-forms-update/)
- [core/commonモジュールの変更について](/post/ng4-feature-core-update/)
- [router/http/animationsモジュールの変更について](/post/ng4-feature-libs-update/)


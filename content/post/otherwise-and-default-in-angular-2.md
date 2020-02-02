+++
date = "2016-04-17T11:25:31+09:00"
title = "Angular 2のデフォルトルートとotherwiseルート"

+++

この記事ではAngular 2のルーターが持つ **useAsDefault** と **otherwise** の違いと、その使い方について解説します。
この2つを使い分けることで柔軟なルーティングを定義することができます。

<!--more-->

## ルートの定義
まず最初に、RouteConfigが適用されているコンポーネントを、この記事では *RouteComponent* と呼ぶことにします。
RouteComponentが表示された時、RouteComponentはその時点のURLのパスを元に、ルーティングを行います。
次の例では、PageAとPageBのそれぞれのルートを定義しています。

```ts
@RouteConfig([
  {path: "/pageA", component: PageA, name: "PageA"},
  {path: "/pageB", component: PageB, name: "PageB"},
])
```

しかし、現在のパスが `/pageA` にも `/pageB` にも一致しない時はどうなるのでしょうか？

### ルートパスに一致させる
例えば、アプリケーションの起動直後にパスが ルートパス( `/` ) だったときにデフォルトで表示したいページがあるとします。
このルート定義では、どちらのルートにもマッチしないのでRouteComponentそのものが表示されるだけでルーティングは行われません。

もし、ルートパスにデフォルトでPageAを表示しておきたいのであれば、 `useAsDefault` プロパティを使い、デフォルトルートを定義することができます。
次の例を見てください。

```ts
@RouteConfig([
  {path: "/pageA", component: PageA, name: "PageA", useAsDefault: true},
  {path: "/pageB", component: PageB, name: "PageB"},
])
```

PageAのルート定義に `useAsDefault` プロパティを追加し、 `true` を渡しています。
こうすることで、RouteComponentはルートパスにアクセスされた時、PageAにルーティングしてくれます。

ただし、デフォルトルートはあくまでも **ルートパスに結びつける** のであって、 それ以外の場合には適用されません。
具体的には、 `/pageC` にアクセスされた時には、やはりどのルートにもマッチせず、ルーティングが行われません。

### otherwiseルートを定義する
そんなときに使えるのが **otherwiseルート** です。
もしあなたがAngularJSのui-routerを使っていたら、馴染みのある機能かもしれません。
otherwiseとは言葉どおり「その他」を定義できる機能です。つまり、どのルートにもマッチしない時にどうするかを設定することができるのです。

`angular2/router`では、otherwiseルートは次のように定義できます。

```ts
  {path: "/**", ...},
```

パスの値は `/**` 以外にも `/*foo` や `/*other` などでも可能です。ただし `/*` は使えません。 
想定外のURLにアクセスされたときにデフォルトでPageAにリダイレクトさせたければ、次のようになります。

```ts
@RouteConfig([
  {path: "/pageA", component: PageA, name: "PageA"},
  {path: "/pageB", component: PageB, name: "PageB"},
  {path: "/**", redirectTo: ["PageA"]},
])
```

もちろんリダイレクトではなく通常のルートとして404用のコンポーネントにルーティングすることもできるでしょう。
すべては設定次第です。

### デフォルトルート vs otherwiseルート
otherwiseルートはデフォルトルートよりも優先度が高いので、
もしotherwiseルートが定義されている場合はルートパスでもotherwiseルートが適用されます。
そのため、トップレベルのRouteComponentではotherwiseを使うと良いでしょう。

デフォルトルートは 非終端ルート( `/...` ) により入れ子になったルートの定義で使います。
`/nested/...` というパスでルーティングされる先のコンポーネントでは、
RouteConfigに必ず1つデフォルトルートを定義する必要があります。
なぜなら `/nested/` にアクセスされたときに表示するコンポーネントが必要だからです。

## まとめ
この記事ではデフォルトルートとotherwiseルートの使い方と違いについて解説しました。
もしAngular 2のルーティングについてもっと広く知りたければ、
公式ドキュメントの [Routing & Navigation](https://angular.io/docs/ts/latest/guide/router.html) を読むとよいでしょう。

+++
date = "2016-06-10T20:18:51+09:00"
title = "Angular 2 Router v3.0.0-alpha.3を触ってみた"

+++
今日リリースされたAngular 2 Router v3.0.0-alpha.3を触ってみたうえでの注意点や感想を書いておきます。

<!--more-->

### インストール

```
$ npm install -S -E @angular/router@3.0.0-alpha.3
```

すでにlatestも3.0.0-alpha.3になっているんですが、とりあえずバージョン固定の `-E` にしておくのをオススメします

また、 `typings` と `typescript@next` が必要です。 前者は `postinstall` で要求されるのでインストール時にだけ必要で、後者はビルドに必要です。

### `@router-deprecated` からの変更点
ほぼすべてが変わったので書き換える箇所は多かったですが、書き換え方は単純だったのでさほど苦しみはなかったです

#### ルート定義

- `RouteConfig` は無くなった
- `RouterConfig` 型でルートを記述する
- `name` は無くなった
- `useAsDefault` は `index` になった
- 入れ子のルートは `children` を使う
- ワイルドカードは `**` 

```ts
export const ROUTES: RouterConfig = [
    { path: '/home', component: HomeCmp, index: true },
    { path: '/chat', component: ChatCmp},
    { 
        path: '/team/:id', 
        component: TeamCmp,
        children: [
            { path: '/details', component: DetailsCmp }
        ] 
    },
    { path: '**', redirectTo: '/home' }
]
```

- **bootstrap時に `provideRouter` を使う**

`RouterOutlet` の使い方は今までと変わりません。ルートのコンポーネントと、`children`を持つコンポーネントは`<router-outlet>`を持つ必要があります

```ts
import {ROUTES} from './app.routes';

bootstrap(App, [
    provideRouter(ROUTES);
]);
```

これまでと違い、ルート定義はコンポーネントの持ち物ではなく、アプリケーションの持ち物になりました。
`@RouteConfig` で書いていたルート定義をカットアンドペーストでガシガシ集めていく作業です。

#### ナビゲーション
ルート定義から `name` がなくなったので、必然的にURLのパスでナビゲーションを行います。
セグメントを配列形式で表現するのはそのままです。

```ts
this.router.navigate(['/team', this.teamId, 'user', this.userName]);
```

RouterLinkを使うと次のようになります。これもほとんど変わってないですね

```html
<a [routerLink]="['/team', teamId, 'user', userName]">{{ userName }}</a>
```

相対パスでの移動も可能ですが、今のところは相対パスの解決をするために `ActivatedRoute` を使わないといけません

```ts
@Component({...})
class TeamCmp {

    constructor(private router: Router, private route: ActivatedRoute) {
    }

    navigateToMember(name: string) {
        this.router.navigate(['./user', name], { relativeTo: this.route });
    }
}
```

すこし冗長ですが、`relativeTo` に渡したRoute(つまり `/team/:id`) を起点にパスの解決をしてくれます。
`ActivatedRoute` はこのあとにも何度も出てくるRouter v3の重要キャラクターです。

クエリパラメータを付けてナビゲートしたいときは次のようにします

```ts
const params = { foo: 'bar' };

this.router.navigate(['/with-query-params'], { queryParams: params });
// => /with-query-params?foo=bar
```

フラグメント( `#section` 的なやつ) も同様です

```ts
this.router.navigate(['/with-fragment'], { fragment: 'sectionA' });
// => /with-fragment#sectionA
```

リンクパラメータの中にオブジェクトを挿入すると、そのセグメントでのマトリクスパラメータになります。
v1やv2ではこれがクエリパラメータと混ざってしまうバグなどありましたが、完全に別物になったので使いやすくなりました

```ts
this.router.navigate(['/foo', {extra: true}, 'bar']);
// => /foo;extra=true/bar
```

#### パラメータの受け取り
コンポーネントが現在のルートからデータを取得するためには `ActivatedRoute` を使います。

`/team/:id` のようなURLパラメータは `ActivatedRoute#params` から取得できます。
これはObservableになっていて、`.subscribe`することで非同期的にパラメータを取得できます。

```ts
@Component({...})
class TeamCmp {
    id: string;

    constructor(private router: Router, private route: ActivatedRoute) {
    }

    ngOnInit() {
        this.route.params.subscribe(params => {
            this.id = params['id'];
        });
    }
}
```

今までは確実にルーターから読み込まれたときにパラメータを取得するには `routerOnActivate` で `ComponentInstruction` を受け取る必要がありましたが、
`ActivatedRoute`がその役目を負ってくれるので、コンポーネントの初期化は`ngOnInit`にまとめることができます。

上位のルートのパラメータを取得するには少し複雑になります。例えばユーザー詳細からチームのIDを手に入れるには次のように書きます


```ts
@Component({...})
class UserCmp {
    teamId: string;
    name: string;

    constructor(private router: Router, private route: ActivatedRoute) {
    }

    ngOnInit() {
        const teamRoute = this.router.routerState.parent(this.route);
        this.teamRoute.params.subscribe(params => {
            this.teamId = params['id'];
        });
        this.route.params.subscribe(params => {
            this.name = params['name'];
        });
    }
}
```

クエリパラメータやフラグメントも同様にObservableで手に入ります。これらはどのルートにいるかに寄らないので、`Router`だけで取得できます。

```ts
const currentState = this.router.routerState;
currentState.queryParams.subscribe(params => {
    // params: {[key:string]: string}
});
currentState.fragment.subscribe(fragment => {
    // fragment: string
});
```

#### その他
ルートの状態の変更は `Router#events` からObservableで取得できます。

```ts
this.router.events.subscribe(ev => {
    console.log(ev);
});
```

`CanActivate` や `CanDeactivate` はまだ試せていません。 `Guard` という仕組みもあって強力な遷移制御ができるので、後日試します。
公式のサンプルを見るとCanDeactivateとGuardの実例があるので参考になると思います。

http://plnkr.co/edit/ER0tf8fpGHZiuVWB7Q07?p=preview

### 注意点

#### TypeScript 1.9を要求する
配布されているパッケージが含んでいるd.tsファイルに`readonly`が含まれているので、TypeScript 1.9以降でないとビルドできません。

#### いくつかのバグ
次の2つのバグを踏みました。

- [Bug: CanDeactivate doesn't run from child route · Issue #26 · angular/vladivostok](https://github.com/angular/vladivostok/issues/26)

ネストされたルートから別のネストの中のルートに移動しようとすると、`CanDeactivate`の解決順序のバグでエラーが発生します。
ワークアラウンドとして、直接ナビゲートするのではなく、上位のルートを踏んでから段階的に遷移することで回避できます。

```ts
// from menu1/item1
this.router.navigate(['/'])
    .then(() => {
        this.router.navigate(['/menu2/item1']);
    });
```

- [Bug: URL is not updated to index route path · Issue #16 · angular/vladivostok](https://github.com/angular/vladivostok/issues/16)

`index` オプションを使って設定したルートが使われるときに、本来のURLに書き換えられないバグです。
`/home` をindexにしたときに、 `/` に来たらHomeCmpが表示されますが、URLは`/`のままになってしまいます。

これは今のところどうしようもないので、無理やり解決したければURLの変更を監視してlocationを書き換えないといけません


### 所感
Router v1やv2とはルート定義の書き方が大きく変わりましたが、そこは本質ではなくて、Observableの積極的な活用こそがv3の肝です。
Observableによって手に入る最新の状態を使えば良いので、`RouteParams`や`ComponentInstruction`で混乱することはありません。
ミュータブルな値を扱わずに済むというのが、v3が素晴らしいルータである理由のひとつです。

とはいえまだalphaバージョンでバグもあり完全ではないですが、すぐにBeta Routerから移行できるだけのものは揃っているようです。
ルート定義が増えるほど手間も増えるので、Beta Routerを使っている場合はなるべく早く書き換えたほうがよいでしょう。
これから開発する場合はv3で決まりです。

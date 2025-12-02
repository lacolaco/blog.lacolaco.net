---
title: 'Angular: Signal as a Dependency（依存オブジェクトのシグナル化）'
slug: 'angular-signal-as-a-dependency'
icon: ''
created_time: '2023-09-06T07:30:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
tags:
  - 'Angular'
  - 'Signals'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Signal-as-a-Dependency-4a9df5fd86fa43de838cf962af587ebe'
features:
  katex: false
  mermaid: false
  tweet: true
---

最近思いついて、妙案ではないかと感じているもの。まだはっきり断言はできないが、もし興味を持った読者がいたら試してみて感想や意見をもらいたい。

---

Angularアプリケーションにおいて、あるサービスクラスが別のサービスクラスに依存することは多い。たとえば、あるコンポーネントのUIの状態が、ユーザーの認証状態に依存するというとき、これまでは次のようにクラスが記述されることが多かった。つまり、あるサービスが保持する状態にアクセスするために、そのサービスのインスタンスへの依存を宣言する（ `inject(UserAuthState)` ）ということである。

```typescript
export type UserAuth = { permissions: string[] };

// ユーザーの認証状態を管理するrootスコープのサービス
@Injectable({ providedIn: 'root' })
export class UserAuthState {
  $currentUser = signal<UserAuth | null>(null);
}

// Appコンポーネントの状態を管理するコンポーネントスコープのサービス
@Injectable()
export class AppState {
  userAuth = inject(UserAuthState);

  $isAdmin = computed(() =>
    this.userAuth.$currentUser()?.permissions?.includes('ADMIN')
  );
}

@Component({
  selector: 'my-app',
  standalone: true,
  providers: [AppState],
  template: `
    <button [disabled]="!state.$isAdmin()">Admin Only</button>
  `,
})
export class App {
  state = inject(AppState);
}
```

ここで考えなければならないのは、このシステムにおいて、真に依存関係があるのは状態のレベルであって、クラスのレベルではない。 `AppState` クラスが  `UserAuthState` クラスに依存しているのはその中身の `$currentUser` にアクセスするためで、クラスそのものには興味がない。

そのことがよく現れるのはこの `App` コンポーネントのテストを書こうとしたときで、 `$isAdmin` がtrueになるようなテストケースを書くためにまず思いつくのは `UserAuthState` クラスのインスタンスを差し替えることだ。

```typescript
// テストコードは @testing-library/angular を使ったコードで示す。
// 1. UserAuthState のインスタンスを差し替える
await render(App, {
  providers: [
    {
      provide: UserAuthState,
      useValue: {
        $currentUser: signal({ permissions: ['ADMIN'] }),
      },
    },
  ],
});
```

クラスそのものに関心がないからこそ、関心のあるフィールドだけを持ったモックオブジェクトを作成することになる。また、特に好ましくないのは、 `App` コンポーネントが直接依存しているのは `AppState` サービスなのに、テストケースのために間接的な依存である `UserAuthState` を差し替えていることだ。

`AppState` を差し替えるにしても、同様にインスタンスの実態はモックオブジェクトにならざるを得ない。なぜかというと `AppState` もAngularのInjectorによるインスタンス化を前提としているからだ。`UserAuthState` の注入が必要なので、 `new AppState()` はできない。やるにしてもInjection Contextのセットアップが必要になり、結局 `UserAuthState` が必要になる。

```typescript
// 2. AppState のインスタンスを差し替える
await render(App, {
  componentProviders: [
    {
      provide: AppState,
      useValue: {
        $isAdmin: signal(true),
      },
    },
  ],
});
```

つまりこのアプローチでは、本物の `AppState` を使おうとすれば`UserAuthState` のモックが必要になり、`UserAuthState` を関心から外すには 本物の `AppState` は使えない、ということになる。

`AppState` のようなコンポーネントスコープのサービスは、コンポーネントと協調して動作しなければ意味がない。そういう意味で、この2択はどちらも選びたくないものだった。

## Signal-as-a-Dependency

そこで思いついたのは、依存関係が状態のレベルなら、それをそのまま表現してみてはどうか、ということだ。クラスからクラスに依存するのではなく、クラスが必要とする外部の状態に直接依存する。これは、 `Signal` 型のオブジェクト（シグナル）をコンストラクタ引数で受け取る形で表現できる。ただのオブジェクトではなくSignalなので、外部での状態変化に反応して `$isAdmin` の値は追従できる。

```typescript
export class AppState {
  constructor(readonly $currentUser: Signal<UserAuth | null>) {}

  $isAdmin = computed(() =>
    this.$currentUser()?.permissions?.includes('ADMIN')
  );
}
```

もちろん、このクラスのインスタンス化は、AngularのDependency Injectionでそのまま解決はできない。このクラスをどのようにインスタンス化すればよいかは、 `AppState` クラスのプロバイダー関数で教える必要がある。 `provideAppState` 関数を作成し、 `useFactory` でファクトリー関数を定義する。ここではプロバイダー関数に引数があればそれをそのまま利用し、なければDependency Injectionで必要なオブジェクトを解決して `new` している。

```typescript
// プロバイダー定義を返す関数
export function provideAppState(override?: AppState) {
  return [
    {
      provide: AppState,
      useFactory: () => {
        if (override) return override;
        const userAuth = inject(UserAuthState);
        return new AppState(userAuth.$currentUser);
      },
    },
  ];
}

@Component({
  selector: 'my-app',
  standalone: true,
  imports: [CommonModule],
  // コンポーネントのプロバイダー宣言で呼び出す
  providers: [provideAppState()],
  template: `
    <button [disabled]="!state.$isAdmin()">Admin Only</button>
  `,
})
export class App {
  state = inject(AppState);
}
```

一見冗長だが、このプロバイダー関数を今後書き直すのは `AppState` のコンストラクタ引数が増えたときだけだし、このプロバイダー関数はテストでなかなか便利に使える。

新しい `AppState` と `provideAppState()` 関数により、ユーザーの認証状態を変更するテストコードは次のようになる。  `UserAuthState` クラスへの依存をやめたことで、 `new AppState(user)` の形でインスタンス化できるようになった。このインスタンス化にDependency Injectionは一切関わっていない。また、そのインスタンスをコンポーネントから参照させるために使うのは、アプリケーションコードでも使ったのと同じ `provideAppState()` 関数である。オプショナル引数を受け付けるようにしておくことで、同じプロバイダー定義を再利用できる。

```typescript
// AppState のインスタンスを差し替える
const state = new AppState(signal({ permissions: ['ADMIN'] }));
await render(App, {
  componentProviders: [provideAppState(state)],
});
```

このアプローチであれば、[本物を使ってテストする](https://twitter.com/t_wada/status/1216953597637713921)ことに以前よりも近づいているだろう。 `App` コンポーネントが直接依存していない `UserAuthState` についての関心は漏れ出てこない。それは自身のインスタンス化についての `AppState` の責任にとどまる。

ちなみに、これと同じことは Signal が登場する以前でも、Observableを使って実現できた。しかし外部ライブラリが必要なObservableとフレームワークビルトインのSignalでは、アプリケーションにおけるプリミティブ具合がまるで違う。また、Observableは本質的に状態管理の道具ではなく（「現在の値」という概念がない）、常に非同期という属性と不可分であり、それが状態の管理を複雑にするが、Signalは通知機能がついた同期的な値であってその点でも簡単になる。

コンポーネントに近いスコープのサービスクラスは、このようなアプローチを試してみるとコンポーネントと一緒に統合テストが書きやすくなる。モックオブジェクトを作るニーズが減り、テストコードの見通しもよくなる効果を見込んでいる。


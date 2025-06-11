---
title: 'Angular: APP_INITIALIZERとEffectの用法'
slug: 'angular-app-initializer-and-effect'
icon: ''
created_time: '2023-09-08T10:20:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Signals'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-APP_INITIALIZER-Effect-3d881d0fdcf44c19ada86ceb05f8e874'
features:
  katex: false
  mermaid: false
  tweet: false
---

Signal APIの `effect` はSignalの値の変更に反応して副作用を実行できる機能だ。サンプルコードではコンポーネントクラスの中で使われているものが多いが、別にコンポーネントと関係ないところで呼び出すこともできるし、なんならクラスのコンストラクタやメソッドである必要もない。インジェクションコンテキストでさえあればどこでもよいことになっている。

[https://angular.jp/guide/signals#effect](https://angular.jp/guide/signals#effect)

[https://angular.jp/guide/dependency-injection-context](https://angular.jp/guide/dependency-injection-context)

```ts
@Component({...})
export class EffectiveCounterCmp {
  readonly count = signal(0);
  constructor() {
    // Register a new effect.
    effect(() => {
      console.log(`The count is: ${this.count()})`);
    });
  }
}
```

ということで今回、 `APP_INITIALIZER` と `effect` を併用してみた。

[https://angular.jp/api/core/APP_INITIALIZER#usage-notes](https://angular.jp/api/core/APP_INITIALIZER#usage-notes)

たとえば、アプリケーションのログインユーザー情報を外部のサービス（たとえばGoogle AnalyticsやSentryなど）に送信したいケース。一般化すれば、アプリケーション内部の状態の変化を一方的に外部サービスへ同期したいような場面では、状態の変更を購読する形で実装したい。状態がSignalであれば、次のように副作用として記述できる。

```ts
// Sentry.setUserのようなもののイメージ
const analyticsService = {
  setUser: (user: User | null) => {
    if (user) {
      console.log(`set user: ${user.name}`);
    } else {
      console.log(`unset user`);
    }
  },
};

// ユーザー情報が更新されるたびにsetUserする副作用
function bindUserToAnalytics($user: Signal<User | null>) {
  effect(() => {
    const user = $user();
    analyticsService.setUser(user);
  });
}
```

ではこの `effect` をどう呼び出すかというと、 `APP_INITIALIZER` のファクトリー関数で呼び出す。 `useFactory` 関数のスコープはインジェクションコンテキストである。 `inject()` が呼び出せるということは `effect()` も呼び出せる。このようにアプリケーションの初期化のタイミングで副作用を宣言しておけば、アプリケーション側からはまったく関心を向けずにおくことができる。

```ts
bootstrapApplication(App, {
  providers: [
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const userAuth = inject(UserAuthService);
        bindUserToAnalytics(userAuth.$currentUser);

        return () => {};
      },
    },
  ],
});
```

いままではこういうアプリケーション初期化時の宣言的コードは `AppComponent` に担わせがちだったが、この形のほうがうまく関心を分離できている。

何もしない関数を返しているのが気持ち悪ければ、初期化関数をインジェクションコンテキストにしてしまってもよいが、結果にほとんど違いはない。汎用的にユーティリティ関数を作れば、次のようにまとめられる。

```ts
function bindUserToAnalytics($user: Signal<User | null>) {
  effect(() => {
    const user = $user();
    analyticsService.setUser(user);
  });
}

function provideAppInitializer(fn: () => unknown): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: () => {
        const envInjector = inject(EnvironmentInjector);
        return () => {
          runInInjectionContext(envInjector, fn);
        };
      },
    },
  ]);
}

bootstrapApplication(App, {
  providers: [
    provideAppInitializer(() => {
      const userAuth = inject(UserAuthService);
      bindUserToAnalytics(userAuth.$currentUser);
    }),
  ],
});
```

SignalやEffectの可能性はまだまだ未知数で、サンプルコードに固定観念を植え付けられてはいけないということは間違いない。

実際に動くサンプルを貼っておく。

https://stackblitz.com/edit/angular-f2bgnd?ctl=1&embed=1&file=src/main.ts

---
title: 'rx-angular/state を使ったコンポーネントローカル状態管理'
slug: 'rx-angular-component-state-management'
icon: ''
created_time: '2022-10-26T06:46:00.000Z'
last_edited_time: '2022-10-26T00:00:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'rx-angular'
  - '状態管理'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/rx-angular-state-e7898e37330444828657dff38ca1f349'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular v14からのスタンドアロンコンポーネントを中心とした新しい流れの中で、RxAngularファミリーの `@rx-angular/state` を使ったAngularコンポーネントの状態管理が個人的に気に入っているので紹介したい。

https://www.rx-angular.io/docs/state

ちなみに、単純に機能の面だけみれば NgRx Component Store や Elf など他にも同様のライブラリはある。RxAngularを今回取り上げたのは、個人的に筋がいいと思っているのと、それらと比べて知名度がまだ低そうなので持ち上げたいのが理由である。

[https://ngrx.io/guide/component-store/](https://ngrx.io/guide/component-store/)

https://ngneat.github.io/elf/

ライブラリの導入やチュートリアルについては公式ドキュメントを見てもらうべきであるので、ここではRxAngularを使った実装の例を見てもらうことにする。

## RxAngularを使ったSingle State Streamパターン

**Single State Streamパターン**とは、私がそのように名付けて呼んでいるAngularコンポーネントの状態管理パターンのひとつである。端的に言うと、あるコンポーネントの状態を1つのStream (Observable)として扱い、テンプレートの大部分を同期的なバインディングで記述するものである。詳しくはSingle State Streamパターンについて書いた記事を読んでほしい。

https://blog.lacolaco.net/2019/07/angular-single-state-stream-pattern/

シンプルな例として、ユーザー情報を非同期的に取得して表示するようなケースだと、このようになる。

```ts
import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RxState } from '@rx-angular/state';

type State = {
  user: User | null;
  userFetching: boolean;
};

const initialState: State = {
  user: null,
  userFetching: false,
};

@Component({
  selector: 'my-app',
  standalone: true,
  imports: [CommonModule],
  providers: [RxState],
  template: `
    <ng-container *ngIf="state$ | async as state">
      <div><button (click)="load()">Load</button></div>

      <ng-container *ngIf="state.userFetching; else showUser">
        <span>Loading...</span>
      </ng-container>

      <ng-template #showUser>
        <span>User Name: {{ state.user.name }} </span>
      </ng-template>
    </ng-container>
  `,
})
export class AppComponent {
  private readonly store = inject<RxState<State>>(RxState);

  readonly state$ = this.store.select();

  constructor() {
    this.store.set(initialState);
  }

  load() {
    this.store.set({ userFetching: true });
    // fetch user asynchronously
    setTimeout(() => {
      this.store.set({
        user: { name: 'John' },
        userFetching: false,
      });
    }, 1000);
  }
}
```

Stackblitzで動作するサンプルはこちら。

https://stackblitz.com/edit/angular-ivy-r34mhv?ctl=1&embed=1&file=src/app/app.component.ts

`RxStore` の注入を `inject()` 関数で行っているが、これはもちろんコンストラクタ引数でも構わない。

```ts
export class AppComponent {
  readonly state$ = this.store.select();

  constructor(private readonly store: RxState<State>) {
    this.store.set(initialState);
  }
}
```

rx-angular/state の特徴的な点は、状態の初期化が遅延されていることだ。多くの状態管理ライブラリや `BehaviorSubject` による素朴な状態管理では、 `initialState` を与える初期化が一般的である。そのStateの型に合った初期値をインスタンス生成時に与える必要があるが、 `RxState` には `initialState` という概念はない。

`select()` メソッドが返すObservableは最初の `set()` が呼び出されるまで何も値を流さない。初期値を与えたければ、利用者がコンストラクタなどの初期化にふさわしいタイミングで `set()` メソッドを使って状態をセットすればいい。大抵のケースではそうすることになるだろう。だが、初期値を与えるかどうかをユーザー側で選択できるようにしていることが面白い。

## 継承を使ったパターンを避けたい理由

rx-angular/state の `RxState` クラスは上記のようにサービスとしてDI経由で利用できるが、クラスの継承を使った使い方も提示されている。

Setup | RxAngular [https://www.rx-angular.io/docs/state/setup#inherit](https://www.rx-angular.io/docs/state/setup#inherit)

```ts
@Component({})
export class StatefulComponent extends RxState<{ foo: number }> {
  readonly state$ = this.select();

  constructor() {
    super();
  }
}
```

コンポーネントクラスが `RxState` クラスを継承することで、コンポーネント自身の `this` が `select()` や `set()` などのAPIを持つようになる。

この書き方は手軽さではあるが、あまり本格的に使いたいものではない。その理由はテンプレートに対する可視性や意図しない外部へのAPIの露出によって、このライブラリへの結合が複雑になってしまうことがある。 `this` に `RxState` のAPIが継承されるということは、テンプレート内で直接 `set()` できてしまうということだ。うっかり参照してしまうことを避けるために、継承ではなくDIによるクラスフィールドとして `private` の可視性で扱い、テンプレートから参照できるのはテンプレートで使われることを意図したフィールドだけにしたい。

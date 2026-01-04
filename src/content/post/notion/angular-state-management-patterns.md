---
title: 'Angularアプリケーションの状態管理パターン'
slug: 'angular-state-management-patterns'
icon: ''
created_time: '2022-05-11T02:10:00.000Z'
last_edited_time: '2023-12-30T10:06:00.000Z'
tags:
  - 'Angular'
  - '状態管理'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-49cd00ee40f044eca73c43f946510dff'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angularアプリケーションの状態管理の方法はさまざまな実装がありえるが、その中でも典型的ないくつかのパターンを、それがどのようなニーズがあって選ばれるのかという考察を踏まえながら列挙する。パターンとその特徴を例示するのであって、それぞれのパターンにおける最良の実装を示すものでもないし、これらのパターンに該当しない実装を否定するものでもない。

Standalone Componentsなど、Angularのメンタルモデルが変わっていく兆しを見せる今、これらをまとめておくことは諸々のAngularアプリケーションの状態管理のあり方を見直すきっかけになるのでないかと思う。特に、NgRxがデファクトスタンダードであり唯一の選択肢だと考えている人には、それが単にひとつの選択肢であることを思い出してもらえるのではないだろうか。

## コンポーネントクラスによる直接の状態管理

一番最初のパターンは、次の例のようにコンポーネントクラスが自身のクラスフィールドで状態管理をするものである。状態管理のあり方としてはもっとも素朴で、単純なパターンである。

```typescript
@Component({
  template: `<p> {{ message }} </p>`
})
export class MyComponent {
  message: string;

  updateMessage(message: string) {
    this.message = message;
  }
}
```

このパターンは、Angularのコンポーネントのもっとも原始的な姿であって、あらゆるAngularアプリケーションはこのパターンからスタートするといってもいい。言いかえれば、このパターンから外れた状態管理というのは、なんらかのニーズがあってリファクタリングされたものである。

## コンポーネントクラスによるリアクティブな状態管理

最初のパターンに次のようなニーズが生まれると、次の段階にリファクタリングされると考えられる。

- コンポーネントが管理する状態が増えたため、コンポーネントクラスの複雑化に対処したい
  - コンポーネントクラスのコード削減
- 手続き的なコードをリアクティブに書きたい
  - イベントドリブンに処理を行うことで非同期処理との親和性を高める

このパターンは、最初のパターンと同じくコンポーネントクラスのフィールドとして状態管理するが、その管理がリアクティブな形式に沿っている点が違っている。次のような実装を想像してほしい。

```typescript
import { createStore } from 'awesome-state-management-library';

const store = createStore({ message: '' });

@Component({
  template: `<p> {{ message$ | async }} </p>`
})
export class MyComponent {
  readonly message$: Observable<string> = store.select(state => state.message);

  updateMessage(message: string) {
    store.setState({ message });
  }
}
```

`createStore` はなんらかの状態管理用のユーティリティであり、その詳細はここではどうでもよい。ポイントは次の3点である。

- 管理される状態は、そのコンポーネントに固有の状態である
- コンポーネントは状態管理の詳細な実装を知らない
- 管理された状態は `Observable` としてコンポーネントに公開されている

## コンポーネントローカルなサービスによる状態管理

コンポーネントクラスによる状態管理からコンポーネントローカルなサービスによる状態管理に移行するニーズは次のようなことが考えられる。

- 子コンポーネントとの間で状態を共有するのを便利にしたい
  - コンポーネントクラスの状態はInputを介して伝播させるしかない
- 複雑な状態管理についての保守性を改善したい
  - コンポーネントと独立して状態管理だけをテストできない

コンポーネントローカルなサービスとは、コンポーネントの `providers` によって提供され、そのコンポーネントないし子孫コンポーネントでのみ利用可能であるようなサービスを指す。Facade パターンと呼ばれることもある。次のような実装を想像してほしい。

```typescript
// my-component-store.ts
import { createStore } from 'awesome-state-management-library';

const store = createStore({ message: '' });

@Injectable()
export class MyComponentStore {
  readonly message$ = store.select(state => state.message);

  updateMessage(message: string) {
    this.store.setState({ message });
  }
}

// my-component.ts
import { MyComponentStore } from './my-component-store'; 

@Component({
  template: `<p> {{ message$ | async }} </p>`,
  providers: [MyComponentStore]
})
export class MyComponent {
  readonly message$: Observable<string> = this.store.message$;

  constructor(private store: MyComponentStore) {}

  updateMessage(message: string) {
    this.store.updateMessage(message);
  }
}
```

コンポーネントクラスによる状態管理から変わったポイントは次の2点である。

- 状態管理の実装の詳細はサービスクラスに移されている
- コンポーネントクラスは状態管理の実装に関心を持たない

状態管理のコードが別のクラスに移動しただけのようにも見えるが、これによって状態管理に関するコードだけをテストすることが簡単になる。コンポーネントにはさまざまな関心が絡みついているため、コンポーネントのテストよりも、状態管理だけの特化したサービスをテストするほうがはるかに単純である。

また、サービスとして利用できるようにしたことで、 `MyComponent` だけでなくその子孫コンポーネントにおいても依存オブジェクトとしてインジェクトできるようになる。親コンポーネントが管理する状態を子孫コンポーネントからも参照したい場合には、テンプレート上でInputのバケツリレーで値を渡すよりも、このようにサービスクラスにしてしまうほうが便利な場合もある。ただしその場合は、子コンポーネントのテストにおいても状態管理サービスの依存解決が必要になるため、ユニットテストの単純さを優先する場合は Input で状態を受け取る選択肢も変わらず有用である。

## シングルトンサービスによる状態管理

コンポーネントローカルなサービスによる状態管理からシングルトンサービスによる状態管理に移行するニーズには次のようなことが考えられる。

- 親子関係にない離れたコンポーネントとの間で状態を共有したい
- コンポーネントよりも長いライフサイクルで状態を保持したい

シングルトンサービスとは、典型的には `@Injectable({ providedIn 'root' })` で提供されるような、コンポーネントの親子関係などにかかわらず同一のインスタンスにアクセスできるようなサービスである。

```typescript
import { AppStore } from '../app-store';

@Component({
  template: `<p> {{ message$ | async }} </p>`
})
export class MyComponent {
  readonly message$: Observable<string> 
    = this.appStore.select(state => state.message);

  constructor(private appStore: AppStore) {}

  updateMessage(message: string) {
    this.appStore.setState({ message });
  }
}
```

状態管理を担うサービスクラスがシングルトンになったことで、大きく変わるのは次のポイントである。

- 状態管理サービスは、特定のコンポーネントへの**関心を持たない**
- 状態のライフサイクルはコンポーネントのライフサイクルと**一致しない**

シングルトンサービスによる状態管理はライフサイクルがコンポーネントよりも長いため、コンポーネントは状態の初期化やリセットなど、いわば **『状態の状態』** を気にしなければならない。

また、このパターンでは、「コンポーネントの状態」ではなく「アプリケーションの状態」を個々のコンポーネントが利用することになる。したがって、アプリケーションの状態の中には、コンポーネントごとに要・不要が異なる値が含まれるし、その値も特定のコンポーネントのために用意されているわけではない。よって、状態を利用するコンポーネントの側では、必要な状態を「取り出し」「整える」工程が必要になる。

## 状態管理ユーティリティの実装について

ここまでの例で登場した `createStore` ユーティリティは、さまざまな実装例が考えられる。たとえば簡素ではあるが、次のようにRxJSだけで実装することもできる。

```typescript
import { BehaviorSubject } from 'rxjs'; 

export function createStore(initialState) {
  const subject = new BehaviorSubject(initialState);
  return {
    select: (fn) => subject.pipe(map(fn)),
    setState: (state) => subject.next(state),
  };
}
```

もちろんライブラリを使ってもいい。このようなStoreオブジェクトの生成は `@ngrx/component-store` をはじめとして多くのライブラリがサポートしている。フレームワークを問わずに利用できるライブラリがあれば、そのライブラリを組み込んで実装することに制約はない。

- [https://ngrx.io/guide/component-store](https://ngrx.io/guide/component-store)
- [https://datorama.github.io/akita/docs/angular/local-state](https://datorama.github.io/akita/docs/angular/local-state)
- [https://ngneat.github.io/elf/](https://ngneat.github.io/elf/)
- [https://rematchjs.org/](https://rematchjs.org/)

一方で、シングルトンサービスによる状態管理をサポートするライブラリは、Dependency Injection 関連の振る舞いを含める必要があるため、Angularに依存したライブラリになる。このパターンを実装する上で代表的なライブラリは `@ngrx/store` や `@ngxs/store` 、Akitaなどだ。だが、シングルトンサービスによる状態管理であったとしても、サービスの実装までライブラリに任せるか、サービスは自前で用意して上述したような状態管理の核となる部分だけライブラリに任せるかは、アプリケーションごとに判断できる部分だ。

- [https://ngrx.io/guide/store](https://ngrx.io/guide/store)
- [https://rx-angular.io/web/state/general/overview](https://rx-angular.io/web/state/general/overview)
- [https://www.ngxs.io/](https://www.ngxs.io/)
- [https://datorama.github.io/akita/docs/store](https://datorama.github.io/akita/docs/store)

## まとめ

この記事で述べたことの要点をまとめると次の点である。

- 原始状態ではコンポーネントが持つ状態管理の役割は、諸々のニーズに沿って段階的にコンポーネントから距離を取るようにリファクタリングされる
- コンポーネントがクラスフィールドで状態管理するパターンから、シングルトンサービスで状態管理するパターンまでの間にも、いくつかのグラデーションが考えられる。コンポーネントローカルなサービスによる状態管理は、一般的なニーズの多くを解決できる
- シングルトンサービスによるアプリケーショングローバルな状態管理は、これまでAngularアプリケーション開発のトレンドの中でメジャーな選択肢であったが、コンポーネントローカルな状態管理のあり方に注目が集まっている。Angular v14で導入されるStandalone Componentsはそのようなコンポーネント中心の設計を後押しするだろう


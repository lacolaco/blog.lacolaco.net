---
title: 'AngularにおけるstrictPropertyInitializationのベストプラクティス'
slug: 'angular-strict-property-initialization-best-practice'
icon: ''
created_time: '2018-06-27T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'TypeScript'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-strictPropertyInitialization-f798bd04a39e46d2a75a6266c2ee468d'
features:
  katex: false
  mermaid: false
  tweet: true
---

Angular コアチームの Stephen Fluin 氏が、こんなブログ記事をあげている。

https://fluin.io/blog/property-has-no-initializer-and-is-not-definitely-assigned

TypeScript 2.7 から導入された、クラスプロパティの初期化をチェックする`strictPropertyInitialization`オプションの話だ。

tsconfig の`strictPropertyInitialization` オプションを有効にすると、undefined を許容していないプロパティがプロパティ宣言時あるいはコンストラクタで初期化されていないときにコンパイルエラーになる。 これを`strictNullChecks`オプションと併用することで、明示的に `T?`あるいは `T | undefined`という宣言をしない限りかならず初期化を要求される。

たとえば次のようなコードがエラーになる。`name`プロパティは`string`型なので`undefined`を許容せず、初期化漏れのコンパイルエラーになる。

```ts
class Person {
  name: string; // Property 'name' has no initializer and is not definitely assigned in the constructor.

  constructor() {}
}
```

この設定は安全な TypeScript を書くうえでかなり便利だが、Angular においては少し注意が必要である。

Angular で strictPropertyInitialization を使う上で問題になるのは、クラスプロパティのうち Angular のデコレーターによって遅延して初期化されるものだ。

たとえば、`@ViewChild`や`@ContentChildren`などは、クラスの初期化時ではなくコンポーネントのビューツリーの解決時に初期化されるので、strictPropertyInitialization がうまく噛み合わなくなる。

そのため、ビュー解決後は値を持っていることはほぼ確実だが、それまでは undefined になるので、プロパティを`?`としてオプショナルにするか、`| undefined`として`undefined`を許容することになる。

## Stephen のベストプラクティス

Angular コアチームの Stephen は、TypeScript にしたがい、ビュー解決を待つプロパティは`?`でオプショナルにするのを推奨している。

理由は書かれていないが、推測するとコンポーネントのクラス実装とテンプレートは文字列あるいは別ファイルに存在した疎結合の関係であり、開発者の頭の中では確実に存在するとわかっていても、システム上は実行するまで`ViewChild`で取得しようとしている子のビューが存在することは不定である。

次のように、`child`は基本的にオプショナルであり、存在が確認できるときだけ処理をするのがベストである。なぜなら ngIf によるスイッチングなど、コンポーネントの生存中に子ビューの参照が消えることは多々あるからだ。

```ts
class SomeComponent {
  @ViewChild() child?: SomeChildComponent;

  ngAfterViewInit() {
    if (this.child != null) {
      // ...
    }
  }
}
```

## Input プロパティについてのプラクティス

Angular で初期化が問題となるプロパティデコレーターのもうひとつは、`@Input`デコレーターだ。

https://twitter.com/laco2net/status/1011734955565576192

現実問題として、Input にはオプショナルなものと必須なものがある。常に特定の Input が与えられることを前提として記述されるコンポーネントだ。たとえば次のような例が考えられる。

```ts
@Component({
  selector: 'user-card',
})
class UserCardComponent {
  @Input() user: User;
}
```

このコンポーネントで、 `user`をオプショナルにするのは意味論的に避けたいし、契約としてそういったコンポーネントの利用は禁止したい。そのため`user`の型は Non-Nullable な`User`型である。 しかし、これをこのまま放置すると、strictPropertyInitialization オプションで初期化していないとエラーになる。

この問題について尋ねると、別の Angular コアチームメンバーである Rado Kirov 氏からアドバイスをもらえた。

https://twitter.com/radokirov/status/1011794901845962752

https://twitter.com/radokirov/status/1011800376289288193

少し乱暴ではあるが、契約として必ず値が渡されることを求めるプロパティについては、Non-null アサーションオペレータ `!`を使ってプロパティが undefined じゃないことを明示的に示せばいいというものだ。

次のようなコードになる。プロパティの宣言時には必ず初期化されていることを明示し、コンポーネントの初期化後にはそれを確認する。 `?`を使ったものと違い、プロパティの型をオプショナルにしていないので、プロパティを使用するたびに if 文で型ガードを作らなくてもよい。

親からの値が必須である Input プロパティについては、実行時アサーションとセットにした Non-null アサーションオペレータで解決するのが、現状のベストプラクティスになりそうだ。

```ts
@Component({
  selector: 'user-card',
})
class UserCardComponent {
  @Input() user!: User;

  ngOnInit() {
    if (this.user == null) {
      throw new Error('[user] is required');
    }

    this.someFunc(this.user); // no need `if` type guard
  }

  someFunc(user: User) {}
}
```

将来的には codelyzer や language-service でこのへんをチェックして、undefined を許容していない Input への値渡しがテンプレート中で行われていないことを検知してもらいたい。

## Observable の初期化

Store との接続や、リアルタイム DB との接続など、コンポーネントが Observable を購読する必要があるときは、コンストラクタで Observable の初期化をおこなうのがよい。

よくある Redux 的な状態管理をしているアプリケーションだと、このようにコンポーネントとストアを接続する。 そしてコンポーネント内では`subscribe`せず、テンプレート内で`async`パイプを使って非同期ビューを構築する。

```ts
class UserListComponent {
  userList$: Observable<User[]>;

  constructor(store: Store) {
    this.userList$ = this.store.select((state) => state.userList);
  }
}
```

コンポーネント内で`subscribe`する必要がある場合は、Observable の初期化だけをコンストラクタで行い、`subscribe`の開始は`ngOnInit`以降に開始すべきである。 コンストラクタで`subscribe`してしまうと、コンポーネントの初期化より先に値の解決が始まってしまい、変更検知のタイミング制御が困難なり、デバッグしにくくなる。

## まとめ

- `@ViewChild`や`@ContentChild`はオプショナルプロパティとして扱うべし
- 必ず親から値を渡されないと困る`@Input`は、実行時アサーションとセットで Non-null アサーションオペレータを使うべし
- Observable のプロパティ初期化はコンストラクタで行い、`subscribe`は`async`パイプあるいは`ngOnInit`以降に Angular のライフサイクルにあわせて開始するべし

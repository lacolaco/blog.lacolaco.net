---
title: 'Angular: v18.1で @let 構文が追加される'
slug: 'angular-v18-let-syntax'
icon: ''
created_time: '2024-07-03T03:05:00.000Z'
last_edited_time: '2024-07-03T03:05:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'TypeScript'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-v18-1-let-6de8867a98914c24b26cb45aeb3f3e32'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular v18.1で、HTMLテンプレートで使える `@let` 構文が新たに追加されることになったので解説する。この記事を書いている時点ではまだv18.1はRC版だが、特に何も起きなければこのまま正式にリリースされる。

機能としては小さく、長くAngularを使っている人ほどニーズを感じられるような、かゆいところに手が届くのアップデートである。

## 構文

`@let` 構文の基本的な使い方は次の形である。HTMLテンプレート中でローカル変数を宣言できるだけである。`=` で繋いだ右辺には、いわゆる**テンプレート式**を記述できる。ほとんどJavaScriptの式と同じで、一部制約のあるサブセットだ。

```html
@let name = "World";
<div>Hello, {{ name }}</div>
```

[https://angular.dev/guide/templates/binding](https://angular.dev/guide/templates/binding)

この例だとTypeScriptコードのほうにプロパティを持っておけばいい話だが、`@let` 構文が真価を発揮するのは次のようなケースである。たとえば、AsyncPipeで非同期データを購読したうえで、nullであったときにはデフォルト値にフォールバックするようなケースを考える。

```ts
@Component({
  template: `
    @let user = user$ | async ?? defaultUser;
    <div>Name: {{ user.name }}</div>
    <div>Age: {{ user.age }}</div>
  `,
})
class Example {
  user$: Observable<User>;
  defaultUser: User;
}
```

このようなフォールバックは以前はif-elseを用いる必要があり、テンプレートが二重管理になることが多かった。

```html
@if(user$ | async; as user) {
<div>Name: {{ user.name }}</div>
<div>Age: {{ user.age }}</div>
} @else {
<div>Name: {{ defaultUser.name }}</div>
<div>Age: {{ defaultUser.age }}</div>
}
```

Signalを使った値もgetterの呼び出しを一回にできるため、何度も呼び出されていたものをまとめれば、テンプレート中の括弧が減って見やすくなるだろう。

```ts
@Component({
  template: `
    @let state = $state();
    <div>{{ state.foo }}</div>
    <div>{{ state.bar }}</div>
    <div>{{ state.baz }}</div>
  `,
})
class Example {
  $state: Signal<State>;
}
```

あとは、値の変換とその呼び出しの部分を分割することも主な用途だろう。複数の変数を宣言、変換する行をまとめておき、テンプレート全体を見通しやすくできる。

```html
@let userName = user.displayName; @let userAge = user.age; @let userBirthday = user.birthday | date:'yyyy/MM/dd'; @let
welcomeMessage = 'Welcome, ' + userName + '!';

<h1>{{ welcomeMessage }}</h1>
<div>Name: {{ userName }}</div>
<div>Age: {{ userAge }}</div>
<div>Birthday: {{ userBirthday }}</div>
```

このように、`@let` 構文が提供するのはテンプレート中での変数宣言を可能にすることだけであり、それ以上のことはない。機能的には`@if` ブロックの`as` でも実現できることだが、変数宣言のために余計なブロックのネストをしなくてよいこと、その行は変数宣言を目的としていることが明らかであることが主な効果になるだろう。

また、この`@let` 構文で宣言されるテンプレートローカル変数は、その宣言がなされているブロックにスコープが閉じている。クラスフィールドとして宣言するとテンプレート中のどこでも参照できるが、スコープを限定したいときに便利だ。たとえば`@for` ブロックの中で一時的な計算結果を変数に格納しておきたいときなどに役立つ。

```html
<div>
  @for (product of products; track product.id) { @let price = product.price | currency;

  <div>Price: {{ price }}</div>
  } {{ price }}
  <!-- error!! -->
</div>
```

ここまで見たように、`@let` 構文は既存のなにかを非推奨にするものではなく、単純にテンプレートの新しい書き方を追加するものである。なので、すでに書かれていて特に問題のないテンプレートに対して、これを積極的に使うように置き換えていく理由はない。

そもそもテンプレートで行うべきでない関心事は`@let` があろうがなかろうがテンプレートから出すべきだし、逆もまた然りである。だがテンプレートの制約によってしかたなくTypeScriptコード側に書いていたUI的な関心のコードがあれば、それを移動させやすくなる可能性はある。処理が複雑で読みにくくなっているテンプレートに対しては使ってみてもいいだろう。

## 参考リンク

- [https://github.com/angular/angular/issues/15280](https://github.com/angular/angular/issues/15280)
- [https://github.com/angular/angular/pull/56715](https://github.com/angular/angular/pull/56715)

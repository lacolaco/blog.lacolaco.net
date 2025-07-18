---
title: 'Angular: Input を Observable で扱えるようにする Inputs Stream パターン'
slug: 'angular-inputs-stream-pattern'
icon: ''
created_time: '2023-02-14T00:40:00.000Z'
last_edited_time: '2023-12-30T10:05:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'RxJS'
  - 'rx-angular'
published: true
locale: 'ja'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-inputs-stream-pattern'
notion_url: 'https://www.notion.so/Angular-Input-Observable-Inputs-Stream-02ff5a3536af4d6996091ea3f818ad95'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular コンポーネントへのインプット `@Input()` に渡される値の変化を、 `Observable` で扱いたいことは少なくない。今回は最近試していて手触りがよい `@rx-angular/state` を使ったインプットの Observable化を紹介する。このパターンを “Inputs Stream” パターンと名付けたい。

https://stackblitz.com/edit/angular-ivy-3cvcwd?ctl=1&embed=1&file=src/app/app.component.html

## 基本方針

このパターンは次の基本方針から構成される。

- コンポーネントのインプットをsetterメソッドで実装する
- setterメソッドは渡された値をコンポーネント内部の**インプットストア**に格納する
- コンポーネントのロジックやテンプレートに使う値は、インプットストアを購読することでリアクティブに取り出す

## `inputs: RxState<Inputs>`

今回は例として `@rx-angular/state` を使ったインプットストアの実装を示している。単に `new RxState()` しているだけなので特筆することはない。

```ts
private readonly inputs = new RxState<{ name: string }>();
```

## Input setter

こちらもインプットストアの値を更新しているだけで特別なことはしていない。

```ts
@Input()
set name(value: string) {
  this.inputs.set({ name: value });
}
```

## Use inputs

このパターンの利点はインプットの変更を `Observable` で購読できることにあるから、そのように使わないともったいない。同期的に扱うならそもそもこのパターンが不要である。

今回の例はぶっちゃけ同期的でもいい例だが、たとえば `message` の構築に非同期APIの呼び出しが必要なケースなどをイメージするとよい。

```ts
ngOnInit() {
  // initial state
  this.state.set({ message: '' });
  // bind inputs stream to component state stream
  this.state.connect(
    'message',
    this.inputs.select('name').pipe(
      map((name) => `Hello ${name}!`),
    ),
  );
}
```

## Pros / Cons

Inputs Streamパターンの利点はざっくり以下の点が思いつく。

- コンポーネントが同期的に直接持つフィールドを減らせる
  - つまり、なんらかの入力を受けてリアクティブに連動しない状態値を減らせる
  - 結果、同じ情報のアプリケーション内での多重管理が起きにくくなる
- ほとんどのコンポーネントが持つフィールドがパターン化される
  - コンポーネントごとのインプットの差はインプットストアの型の違いに落とし込まれる
  - どのコンポーネントにも同じ名前で同じ使われ方のインプットストアがあるという状態
- 他の RxJS ベースのライブラリとのやりとりに変換作業が不要になる

一方で、欠点として以下の点も思いつく。

- 当然だが、 `Observable` が苦手なら難しい
- 自前で `BehaviorSubject` など使ってインプットストアを実装してもいいが、汎用性をもたせようとすると結構大変なので現実的には何らかのライブラリに頼ることになる
  - 今回は `@rx-angular/state` を使ったが、当然他のものでもなんでもよい

とはいえ慣れるとコンポーネントの `[this.xxx](http://this.xxx/)` に直接保持する状態がなくなることで振る舞いの予測可能性があがり、テストもしやすいように感じているので、ぜひおすすめしたい。

今回のサンプルもそうだが、コンポーネントが状態値を単一のストリームでテンプレートに渡す Single State Stream パターンとの相性もよいので、こちらも改めて紹介しておきたい。

https://blog.lacolaco.net/2019/07/angular-single-state-stream-pattern/

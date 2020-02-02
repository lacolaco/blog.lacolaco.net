+++
date = "2016-04-10T10:29:17+09:00"
title = "[日本語訳] Template-driven Forms in Angular 2"

+++

* Original: [Template-driven Forms in Angular 2](http://blog.thoughtram.io/angular/2016/03/21/template-driven-forms-in-angular-2.html)
* Written by: [Pascal Precht](http://twitter.com/PascalPrecht)
* Translated at: 04/07/2016

<!--more-->

----

# Angular 2におけるテンプレート駆動フォーム

Angularはフォームを組み立てるのに3つの異なる方法を用意しています。
1つはテンプレート駆動、アプリケーションコードを一切必要としない方法です。
そしてローレベルAPIを使ったDOMを一切必要としないモデル駆動の方法と、
最後はハイレベルのAPI、すなわち`FormBuilder`を使ったモデル駆動の方法です。

これらの異なる手段からわかるように、目標を達成するための道具がいくつもあるかもしれないのは当然のことです。
しかし混乱を招いてしまうので、この記事ではAngular 2におけるテンプレート駆動のフォームディレクティブについて明らかにしていきます。

## `ngForm`ディレクティブ
まずはユーザーの情報をいくつか質問するシンプルなログインフォームからはじめましょう。

```html
<form>
  <label>Firstname:</label>
  <input type="text">

  <label>Lastname:</label>
  <input type="text">

  <label>Street:</label>
  <input type="text">

  <label>Zip:</label>
  <input type="text">

  <label>City:</label>
  <input type="text">

  <button type="submit">Submit</button>
</form>
```

私たちはおそらくこんなフォームを何度も作ったことがあります。
ユーザーの名前と住所を入力するコントロールを持ったシンプルなHTMLのフォームで、ここには何の特別なものはありません。

私たちはここで、Angularが連れてきた`<form>`というセレクターを持つ`ngForm`ディレクティブによって、
実は私たちの`form`要素がすでに`ngForm`のインスタンスになっているということに気づきません。
`ngForm`はとある理由のために存在します。
`ngForm`は私たちにフォームが持っている現在の状態を伝えてくれます。状態というのは次のものです。

- フォームの値のJSON表現
- フォーム全体のバリデーション状態


### `ngForm`インスタンスにアクセスする
ディレクティブのメタデータの`exportAs`プロパティを使うと、コンポーネントのテンプレート内でディレクティブのインスタンスにアクセスできます。
例えば、`draggable`ディレクティブを作ったとき、そのインスタンスを次のように`draggable`という名前で外部に露出できます。

```ts
@Directive({
  selector: '[draggable]',
  exportAs: 'draggable'
})
class Draggable {
  ...
}
```

そして、ディレクティブを使っているテンプレート内でローカル変数の仕組みを使ってアクセスすることができます。

```ts
<div draggable #myDraggable="draggable">I'm draggable!</div>
```

ここで`myDraggable`は`Draggable`のインスタンスの参照になっていて、
テンプレート全体で他の式の一部として使うことができます。

これがどうして面白いのか不思議に思うかもしれません。
そう、`ngForm`ディレクティブが`ngForm`として露出されていること、
それは一切アプリケーションコードを書かずに次のようにフォームのインスタンスにアクセスできるということなのです。

```html
<form #form="ngForm">
  ...
</form>
```

### フォームの送信と、値へのアクセス
さあ私たちはフォームの値とそのバリデーション状態にアクセスできるようになりました。
まずはフォームから送信されたデータをログに表示してみましょう。
私たちがやらなければならないのは、フォームの`submit`イベントにハンドラーを追加してフォームの値を渡すことだけです。
実は`ngForm`のインスタンスには`value`プロパティがあるので、次のようになります。

```
<form #form="ngForm" (submit)="logForm(form.value)">
  ...
</form>
```

これでもうまく動きますが、`ngForm`が送信時に発火しているもう一つのイベントがあります。それが`ngSubmit`です。
`ngSubmit`は`submit`と一見すると全く同じです。
しかし、`ngSubmit`はイベントハンドラーがエラーを出したときには(デフォルトの`form`要素と同じように)`submit`されないことと、
HTTPのPOSTリクエストを発生させることが保証されています。
ベストプラクティスとして、`submit`の代わりに`ngSubmit`を使ってみましょう！

```html
<form #form="ngForm" (ngSubmit)="logForm(form.value)">
  ...
</form>
```

さらに、次のようなコンポーネントを用意します。

```ts
@Component({
  selector: 'app',
  template: ...
})
class App {

  logForm(value: any) {
    console.log(value);
  }
}
```

このコードを実行すると、フォームの値は空のオブジェクトなのがわかります。
これは正しい挙動です。なぜならまだコンポーネントのテンプレート中に何もしていないからです。
つまり、私たちはフォームにinput要素を登録しなければなりません。そこで`ngControl`が登場します。

## `ngControl`ディレクティブ
フォームのインスタンスにコントロールを登録するために、`ngControl`ディレクティブを使います。`ngControl`は文字列の名前を持ち、コントロールとしての抽象的なインスタンスを作成します。`ngControl`で登録されたすべてのフォームコントロールは自動的に`form.value`に現れ、簡単に処理できるようになります。

いくつかのオブジェクトをフォームに追加し、フォームコントロールとして登録してみましょう！

```
<form #form="ngForm" (ngSubmit)="logForm(form.value)">
  <label>Firstname:</label>
  <input type="text" ngControl="firstname">

  <label>Lastname:</label>
  <input type="text" ngControl="lastname">

  <label>Street:</label>
  <input type="text" ngControl="street">

  <label>Zip:</label>
  <input type="text" ngControl="zip">

  <label>City:</label>
  <input type="text" ngControl="city">

  <button type="submit">Submit</button>
</form>
```

ばっちりですね！このフォームに適当な値を入力して送信すれば、次のようなログが見られるでしょう。

```
{
  firstname: 'Pascal',
  lastname: 'Precht',
  street: 'thoughtram Road',
  zip: '00011',
  city: 'San Francisco'
}
```

素晴らしいですね！
私たちはこのJSONオブジェクトを手に入れて、サーバーへ直接送信することができます。
しかしちょっと待ってください？もし次のようなもっと複雑な構造が欲しい時はどうすればいいんでしょうか？

```
{
  name: {
    firstname: 'Pascal',
    lastname: 'Precht',
  },
  address: {
    street: 'thoughtram Road',
    zip: '00011',
    city: 'San Francisco'
  }
}
```

フォームをsubmitした時に手で組み立てる必要があるのでしょうか？
答えはノーです！Angularはこれをちゃんとカバーしています。
というわけで、次は`ngControlGroup`の紹介です。

## `ngControlGroup`ディレクティブ
`ngControlGroup`はフォームコントロールをグループ化することができます。
別の言い方をすれば、コントロールグループはコントロールなしには存在できません。
さらに、コントロールグループはその中にあるコントロールがvalidかどうかを引き継いでくれます。
これによって簡単にフォームの中でバリデーションチェックがとても簡単になります。

ここであなたはこう考えるかもしれません。
「ちょっと待てよ？つまりフォーム自体が1つのコントロールグループなんじゃないか？」
そう、その通りです。フォームは1つのコントロールグループです。

さっそく`ngControlGroup`を使ってコントロールをグループ化してみましょう！

```
<fieldset ngControlGroup="name">
  <label>Firstname:</label>
  <input type="text" ngControl="firstname">

  <label>Lastname:</label>
  <input type="text" ngControl="lastname">
</fieldset>

<fieldset ngControlGroup="address">
  <label>Street:</label>
  <input type="text" ngControl="street">

  <label>Zip:</label>
  <input type="text" ngControl="zip">

  <label>City:</label>
  <input type="text" ngControl="city">
</fieldset>
```

ご覧のとおり、上のコードでは私たちはフォームコントロールを`<fieldset>`要素でラップし、
`ngControlGroup`ディレクティブを適用しています。
これは特に意味があるわけではなく、代わりに`<div>`要素を使ってもかまいません。
ポイントは、何かしらの要素である必要があり、
そこに`ngControlGroup`をつけることで`ngForm`に対して登録されるということです。

このフォームを送信すれば次のような出力が得られるでしょう。

```
{
  name: {
    firstname: 'Pascal',
    lastname: 'Precht',
  },
  address: {
    street: 'thoughtram Road',
    zip: '00011',
    city: 'San Francisco'
  }
}
```

完璧ですね！
私たちは望む構造のオブジェクトを一切アプリケーションコードを書かずにフォームだけで構築できました。
しかし不思議に思うかもしれません。Angular 2でフォームの中で`ngModel`を使うとどうなるんでしょうか。
これは良い質問です。

## `ngModel`とは？
Angular 2における`ngModel`は双方向データバインディングを実装しているものです。
ただしそれだけではなく、実はもっと多くのケースでシンプルに使えるものです。
テンプレート駆動のフォームに`ngModel`をどう使えばいいのでしょうか？そもそも`ngModel`を使えるのでしょうか？
もちろん使えます！

`ngForm`や`ngControl`、`ngControlGroup`が提供するのはフォームの構造化と、フォームの値へのアクセスですが、
一方で`ngModel`が提供するのは双方向データバインディングのためのドメインモデルです。
言い方を変えれば、`form.value`はサーバーに送りたいデータであり、
`ngModel`はフォームにデータを与えることができますが、これらは同時に使うことができます。

`ngControl`は`ngModel`がバインドできるようになっています。
つまり次のように書くことが出来ます。

```
<fieldset ngControlGroup="name">
  <label>Firstname:</label>
  <input type="text" ngControl="firstname" [(ngModel)]="firstname">
  <p>You entered {{firstname}}</p>

  <label>Lastname:</label>
  <input type="text" ngControl="lastname" [(ngModel)]="lastname">
  <p>You entered {{lastname}}</p>
</fieldset>
```


## もっと知りたい方は
もちろんここで述べたのはフォームを作る方法の氷山の一角です。
バリデーションについてや、入力されたデータに対してエラーメッセージをどう表示するかなど、話していないことがたくさんあります。
それらについてはまた別の記事で紹介します。
ただしカスタムバリデーターを作る方法については[この記事](http://blog.thoughtram.io/angular/2016/03/14/custom-validators-in-angular-2.html)を見てください。

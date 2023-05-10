---
title: "AngularのContent Projectionの基本"
date: 2020-02-10T15:50:16+09:00
updated_at: 2020-05-05T16:22:44+09:00
tags: ["webcomponents","angular","basic","content-projection"]
foreign: true
---

本稿では Angularコンポーネント間でビュー領域を受け渡しする **Content Projection** という概念と、その実装パターンについてあらためて解説する。

## Re-thinking about `<ul>`

さて、Angularの話に入る前にまずはHTML標準の `<ul>` 要素について考えてみよう。
`<ul>` は言わずとしれた Unordered ListのためのHTML要素だが、われわれが常日頃 `<ul>` を使うときは次のようにHTMLを書く。

```html
<ul>
    <li>Item 1</li>
    <li>Item 2</li>
</ul>
```

Angularの文脈において、開始タグと終了タグの間の`<li>` の位置にあるものは、 `<ul>` の **Content** と呼ばれる。そして、自身に与えられた Content を自身のビューの一部として投影することを **Content Projection** と呼ぶ。AngularJSの概念のなかでは transclusionとも呼ばれたが、今は Content Projectionが一般的な語彙である。

HTML標準要素は基本的にすべての要素が自動的にContent Projectionを透過的におこなう。だからこそわれわれは `<div>` を重ねがけできるし、 `<a>`タグの中に`<button>`タグを置くこともできる。勘がいい読者は気づいているかもしれないが、 `<li>Item 1</li>` における `Item 1` も TextNode のContentである。HTMLとDOMはContent Projectionによって成り立っていて、ほぼすべてのHTML標準要素はContentをそのまま投影する。そしてその投影のネスト構造にあわせたCSSセレクタを使ってスタイリングされている。

## AngularのContent ProjectionとWeb Components

Angularに話を戻そう。Angularのコンポーネントは基本的にWeb Componentsの概念を踏襲している。そのため、Angularのコンポーネントについて学ぶ上でWeb Componentsの基本概念は踏まえておく必要がある。

Web ComponentsのCustom ElementsはHTMLのカスタム要素を定義する機能である。カスタム要素は標準要素と違い、**自動的にContent Projectionはおこなわれない**。特にShadow DOMと組み合わせたカスタム要素は、スタンドアロンでカプセル化されたビューであるため、カプセル化の外からビューを与えて干渉することはカスタム要素側が許可しない限り不可能だ。
そしてShadow DOMでは、自身のDOMツリー内に `<slot>` という要素を宣言すると、その位置にContentが投影される。

https://developer.mozilla.org/ja/docs/Web/HTML/Element/slot
https://developer.mozilla.org/ja/docs/Web/Web_Components/Using_templates_and_slots

これと同様の概念をAngularのコンポーネントも備えていて、それが `<ng-content>` 疑似要素と、 `@ContentChild()` / `@ContentChildren()` 機能だ。
これらの概念は基本的にAngular 2.0.0のリリース時から変わっておらず、Angularのコンポーネント機能の根幹を支えている概念である。

## Content Projection 101: `<ng-content>` 

一番簡単でインスタントなContent Projectionの方法は、Angularコンポーネントのテンプレートで `<ng-content>` 疑似要素を使う方法だ。

https://stackblitz.com/edit/ivy-argkah

このように `HelloComponent` が `<ng-content>` 疑似要素でContent Projectionの準備をしていれば、親コンポーネントがContentを渡せば自動的にその位置に投影される。

```ts
@Component({
  selector: 'hello',
  template: `
  <h1>Hello <ng-content></ng-content></h1>
  `,
})
export class HelloComponent  {}
```

```html
<hello>World</hello>
```

`<ng-content>` は `select` 属性を使って任意のCSSセレクタにマッチしたContentだけを抽出して投影することもできる。次のように `HelloComponent` のテンプレートを編集し、親コンポーネントから `<span greeting>` のようにCSSセレクタにマッチする要素を渡すと、その要素だけを選択して投影する。

https://stackblitz.com/edit/ivy-do5tyk

```html
  <h1>
  <ng-content select="[name]"></ng-content>! 
  <ng-content select="[greeting]"></ng-content> 
  </h1>
```
```html
<hello>
  <span greeting>Hello</span>
  <span name>World</span>
</hello>
```

このとき、`HelloComponent` にとって2種類の _子_ が生まれている。それが**View Child** と **Content Child** であり、Angularのなかでもとりわけ重要な概念である。

`<h1>` 要素は `HelloComponent` の **View Child** である。自身の **ビュー** の一部であり、自身の内部に閉じた本当の子要素である。
Contentとして渡された`World`は、 `HelloComponent` の **Content Child** である。DOMツリー上は子要素として描画されるが、テンプレート上に存在するわけではなくContentとして投影されている意味論上の子要素である。
これらはAngularのレンダリングシステム上で明確に区別されており、AngularのAPIの各所に **View** と **Content** の語彙の使い分けが見られるはずだ。
この基本概念を踏まえなければ、これより先のContent Projectionの理解は難しい。

## Content Projection 201: `@ContentChild()` & `TemplateRef`

`<ng-content>` はテンプレートだけで完結するインスタントな方法だが、現在のAngularの仕様上いくつかの制約がある。

- `<ng-content>` はContentをテンプレート化できない。つまり同じContentを繰り返し投影することができない
- `<ng-content>` はディレクティブクラスによる選択ができない。CSSセレクターによってのみ選択できる

そこで、より柔軟にContentを扱うためのAPIとして `@ContentChild()` APIと `<ng-template>` API が存在する。

https://angular.io/api/core/ContentChild
https://angular.io/api/core/TemplateRef

`@ContentChild()` デコレーターは、その引数の条件に一致するContent Childの参照をコンポーネント内に保持できる機能である。条件に使用できるのは

- ディレクティブ（コンポーネント）クラス
- テンプレート参照変数名

のいずれかである。
次の例では、親から与えられた `<span>` 要素を テンプレート参照変数 `#helloName` をキーにして取得している。

https://stackblitz.com/edit/ivy-fngydx?file=src%2Fapp%2Fapp.component.html

```ts
@Component({
  selector: 'hello',
  template: `
  <h1>
    Hello <ng-content></ng-content>
  </h1>
  `,
})
export class HelloComponent  {

  @ContentChild('helloName')
  content: ElementRef<any>;
}
```

```html
<hello>
  <span #helloName>World</span>
</hello>
```

しかしこのままでは `@ContentChild()` で取得したContentは投影できない。
`<ng-content>` は Contentの取得と投影をセットでおこなうが、 `@ContentChild()` はあくまでもContentの参照を得る機能である。ここで得られる `content` は `<span>` タグの `ElementRef`になっているが、投影をおこなうためには渡されたContentが投影可能な **Template** である必要がある。
Templateは `<ng-template>` タグを使って宣言する。つまり、次のように親から `<ng-template>` 要素をContentとして渡すことができる。

```html
<hello>
  <ng-template #helloName>
    <span>World</span>
  </ng-template>
</hello>
```

`HelloComponent` 側では、 `@ContentChild()` を使って受け取ったTemplateの参照 `TemplateRef` を、 次のように`*ngTemplateOutlet` ディレクティブを使ってテンプレート中に投影する。

https://stackblitz.com/edit/ivy-4y6nwq?file=src%2Fapp%2Fapp.component.html

```ts
@Component({
  selector: "hello",
  template: `
    <h1>Hello <ng-container *ngTemplateOutlet="nameTemplate"></ng-container></h1>
  `,
})
export class HelloComponent {
  @ContentChild("helloName")
  nameTemplate: TemplateRef<any>;
}
```

Templateは再利用可能なテンプレート部品なので、同じContentを何度でも繰り返し表示できる。

https://stackblitz.com/edit/ivy-rr1pwi?file=src/app/hello.component.ts

```ts
@Component({
  selector: "hello",
  template: `
    <h1>Hello <ng-container *ngTemplateOutlet="nameTemplate"></ng-container></h1>
    <h2>Hello <ng-container *ngTemplateOutlet="nameTemplate"></ng-container></h2>
    <h3>Hello <ng-container *ngTemplateOutlet="nameTemplate"></ng-container></h3>
  `,
})
export class HelloComponent {
  @ContentChild("helloName")
  nameTemplate: TemplateRef<any>;
}
```

複雑なContent Projectionが必要なときには、 `<ng-content>` ではなく `@ContentChild()` と `<ng-template>` を使ったアプローチを取る必要がある

## まとめ

- AngularのコンポーネントやWeb Componentsでは Content Projectionは明示的に宣言する必要がある
- インスタントなContent Projectionは `<ng-content>` だけで可能
- 再利用可能なテンプレートを受け取りたいときは `@ContentChild()` と `TemplateRef` を使った方法が必要
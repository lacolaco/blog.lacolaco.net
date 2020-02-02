+++
date = "2016-04-11T00:41:39+09:00"
title = "Angular 2のローカル変数とexportAs"
+++

Angular 2には**local variables**(ローカル変数)という機能があります。
公式のチュートリアルやデベロッパーガイドを読んでいると突然登場してみなさんを惑わしているかもしれません。
しかし、この機能はAngular 2を使いこなす上でとても重要なものなので、ぜひ知っておきましょう。

<!--more-->

## ローカル変数と`#`シンタックス

ローカル変数とは、コンポーネントのテンプレート中で定義して使用できる変数のことです。
ローカル変数には原則として、ローカル変数を定義した要素のインスタンスが代入されます。
ローカル変数の定義は`#`シンタックスを使います。

次の例では、`input`要素をローカル変数`i`として定義し、
ボタンをクリックするときに`input`要素の値をコンポーネントに渡しています。

```ts
@Component({
  selector: 'my-app',
  template: `
    <input type="text" #i>
    <button (click)="submit(i.value)">submit</button>
    <p>
      {{ value }}
    </p>
  `
})
export class App {
  value: string;
  
  submit(value: string) {
    this.value = value;
  }
}
```

ここでローカル変数`i`は`HTMLInputElement`のインスタンスになっています。
ローカル変数を使うと、データバインディングを行うことなく、要素が持つプロパティや属性を直接使うことができます。

### `var-*`シンタックス

`#`シンタックスは簡単に書けて便利ですが、通常だと`#`記号はHTMLの中で使うことができないため、
Angular以外の何らかのツールを使おうとするとエラーを引き起こすことがあります。
そこで正常なHTMLとしての体裁を守ったままローカル変数を定義する方法として、`var-*`シンタックスも用意されています。

`var-*`シンタックスを使って先程のテンプレートを書き直すと次のようになります。

```ts
@Component({
  selector: 'my-app',
  template: `
    <input type="text" var-i>
    <button (click)="submit(i.value)">submit</button>
    <p>
      {{ value }}
    </p>
  `
})
```

## ローカル変数とフォーム
Angular 2のローカル変数は、HTML要素のインスタンスを簡単に得ることができるので、
`form`要素や`video`要素といった、メソッドを持つ複雑な要素と併用することでとても便利になります。
公式のチートシートには`video`要素をローカル変数に代入して`play()`メソッドを使っている例が紹介されています。

```html
<video #movieplayer ...>
  <button (click)="movieplayer.play()">
</video>
```

同じように`form`要素をローカル変数に代入して便利に使ってみましょう！
次の例では`form`要素をローカル変数`f`に代入し、ボタンのクリックイベントで`reset()`メソッドを呼び出しています。

```ts
@Component({
  selector: 'my-app',
  template: `
    <form #f>
      <input type="text">
      <button (click)="f.reset()">reset</button>
    </form>
  `
})
export class App {
}
```

一切スクリプトを書かずにフォームのリセットが実装できました！
初めは見慣れない`#`記号に戸惑うかもしれませんが、実はとても簡単で便利なものだということがわかってきましたか？

## `exportAs`属性
ここまでのローカル変数は定義された要素のインスタンスを引き出すだけでしたが、
ローカル変数は`exportAs`という機能によってさらに強力な機能になります。さっそく見ていきましょう！

`exportAs`属性はディレクティブのメタデータの1つで、
ローカル変数にHTML要素ではなくディレクティブのインスタンスを代入させたいときに使います。
Angular 2に組み込まれている`ngForm`ディレクティブは`exportAs`を活用しているいいサンプルです。
`ngForm`ディレクティブのセレクタは`<form>`に一致するようになっていて、
HTML標準の`form`要素が自動的に`ngForm`ディレクティブで拡張されています。

```ts
@Directive({
  selector: 'form:not([ngNoForm]):not([ngFormModel]),ngForm,[ngForm]',
  bindings: [formDirectiveProvider],
  host: {
    '(submit)': 'onSubmit()',
  },
  outputs: ['ngSubmit'],
  exportAs: 'ngForm'
})
```

[angular/ng_form.ts at master · angular/angular](https://github.com/angular/angular/blob/master/modules%2Fangular2%2Fsrc%2Fcommon%2Fforms%2Fdirectives%2Fng_form.ts#L80-L88)

ここで、`exportAs: 'ngForm'`というメタデータの設定に注目してください。
`ngForm`は`form`要素に一致しますが、ただ`<form #f>`のようにローカル変数を定義しても代入されるのは`HTMLFormElement`のインスタンスだけです。
`form`要素に隠れている`ngForm`ディレクティブのインスタンスを得るには、`<form #f="ngForm">`という定義を行います。
つまり、`exportAs`で指定された名前をキーに、ディレクティブのインスタンスを得ることができるのです。

`ngForm`のインスタンスを使うと、フォームの操作がとても簡単になります。次の例ではフォームに入力された値をJSONオブジェクトとして取り出して表示しています。

```ts
@Component({
  selector: 'my-app',
  template: `
    <form #f #ngf="ngForm" (ngSubmit)="submit(ngf.value)">
      <input type="text" ngControl="name">
      
      <button type="submit">submit</button>
      <button (click)="f.reset()">reset</button>
    </form>
    <p>{{ value | json }}</p>
  `,
  directives: []
})
export class App {
  value: any;
  
  submit(value: any) {
    this.value = value;
  }
}
```

ローカル変数`f`は何も値を与えていないので、`form`要素のインスタンスになりますが、
ローカル変数`ngf`は`ngForm`をキーに`ngForm`ディレクティブのインスタンスが代入されます。
`ngForm`ディレクティブはフォーム全体の値をオブジェクトとして扱える`value`プロパティを持っているので、
`ngSubmit`イベントでコンポーネントに値を渡しています。

このように、テンプレート中でディレクティブのメソッドやプロパティにアクセスできるのがローカル変数と`exportAs`の力です。

## `exportAs`を使ってみよう
もちろん自分で作るディレクティブにも`exportAs`を使うことができます。
最後に自作ディレクティブをローカル変数として扱う例を紹介します。

`MyDiv`ディレクティブは、`div`要素に一致するセレクタと、自身の`text-transform`スタイルを切り替えるメソッドを持っています。
そしてインスタンスを`myDiv`として公開しています。

```ts
@Directive({
  selector: "div",
  exportAs: "myDiv"
})
class MyDiv {
  
  constructor(private element: ElementRef, private renderer: Renderer) {
  }
  
  toUpper() {
    return this.renderer.setElementStyle(this.element.nativeElement, "text-transform", "uppercase");
  }
  
  toLower() {
    return this.renderer.setElementStyle(this.element.nativeElement, "text-transform", "lowercase");
  }
  
  reset() {
    return this.renderer.setElementStyle(this.element.nativeElement, "text-transform", "");
  }
}
```

これをコンポーネントから使うと、次のようになります。

```
@Component({
  selector: 'my-app',
  template: `
    <div #d="myDiv">Angular 2</div>
    <button (click)="d.toUpper()">toUpper</button>
    <button (click)="d.toLower()">toLower</button>
    <button (click)="d.reset()">Reset</button>
  `,
  directives: [MyDiv]
})
export class App {
}
```

[こちら](http://plnkr.co/edit/xDSVImO4wbFYLGIqViFO?p=preview) で実際に動くサンプルを見ることができます。

## まとめ
Angular 2のローカル変数について基礎的な部分を紹介し、`exportAs`を活用することで機能的なディレクティブを作れることがわかってもらえたと思います。
ローカル変数を使うとコンポーネントのコード量を減らし、テンプレート内で直感的にHTML要素やディレクティブのインスタンスを扱うことができます。
ぜひ活用してみてください。

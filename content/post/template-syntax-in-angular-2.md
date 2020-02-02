+++
date = "2016-04-11T00:03:48+09:00"
title = "Angular 2の*シンタックス"

+++

先日主催したイベントで「Angular 2の`*`記号が何の意味があるのかわからなくて気持ち悪い」という声を聞き、意外に知られてないと思ったので一度きちんと書いておこうと思います。
みなさんのAngular 2への理解の手助けになれば幸いです。

<!--more-->

## Angular 2におけるディレクティブ
Angular 2は基本的にコンポーネント志向であり、アプリケーションはコンポーネントで組み立てます。ただし、Angular 1と同じようにHTML要素やコンポーネントを修飾するためにディレクティブを使うことができます。

次の`myDirective`ディレクティブは、付与した要素のスタイルを変更し、`color`を`red`にします。

```ts
import {Component, Directive, ElementRef, Renderer} from 'angular2/core'

@Directive({
  selector: "[myDirective]"
})
class MyDirective {
  
  constructor(
    private el: ElementRef, 
    private renderer: Renderer
  ) {}
  
  ngOnInit() {
    this.renderer.setElementStyle(this.el.nativeElement, "color", "red");
  }
}

@Component({
  selector: 'my-app',
  template: `
    <div myDirective>Hello {{name}}</div>
  `,
  directives: [MyDirective]
})
export class App {
  constructor() {
    this.name = 'Angular2'
  }
}
```

ディレクティブにもコンポーネントと同じようにライフサイクルのメソッドフックが存在します。コンストラクタのDIで得たインスタンスを`ngOnInit`で使用しています。

また、ディレクティブの`selector`メタデータは`myDirective`要素でも`[myDirective]`属性でも、もちろん`.myDirective`クラスでもかまいません。(あまり知られていませんしオススメもしませんが、実はコンポーネントの`selector`も要素である必要はありません。)

## `*`シンタックス：テンプレート化
ディレクティブの基本的なことをおさらいした上で、`*`記号について解説します。まずは上述の`myDirective`ディレクティブが実際にどのようなDOMを生成しているかを確認しましょう。Chromeの開発者ツールでみると、次のような構成になっています。`my-app`要素の中にテンプレートが展開され、その中で`mydirective`属性が付与された`div`要素にスタイルが適用されています。

![Kobito.VDG9G4.png](https://qiita-image-store.s3.amazonaws.com/0/20253/92d3ae19-886f-7b1b-5a1e-9d175a4e1cf0.png "Kobito.VDG9G4.png")

直感的だし、何も違和感のないDOM構造です。ここで、`myDirective`ディレクティブに`*`記号を付けて実行するとどうなるか見てみましょう。

```ts
@Component({
  selector: 'my-app',
  template: `
    <div *myDirective>Hello {{name}}</div>
  `,
  directives: [MyDirective]
})
export class App {
  constructor() {
    this.name = 'Angular2'
  }
}
```

![Kobito.vS1Z2P.png](https://qiita-image-store.s3.amazonaws.com/0/20253/59e3f444-d704-800d-0162-977c07daaa3a.png "Kobito.vS1Z2P.png")

なんと、 `<!--template bindings={}-->`という謎のコメントを残して`div`要素が消えてしまいました！

### 要素の「テンプレート化」
`myDirective`に`*`プレフィックスをつけると`div`要素が消えてしまいました。これは単に消えたのではなく、 **「テンプレート化された」** のです。「テンプレート化」とは、要素をテンプレートとして保存し、いつでも複製できるようにする仕組みのことです。

わかりやすい例として、`ngIf`ディレクティブのソースコードを見てみましょう。

```ts
@Directive({selector: '[ngIf]', inputs: ['ngIf']})
export class NgIf {
  private _prevCondition: boolean = null;

  constructor(private _viewContainer: ViewContainerRef, private _templateRef: TemplateRef) {}

  set ngIf(newCondition: any /* boolean */) {
    if (newCondition && (isBlank(this._prevCondition) || !this._prevCondition)) {
      this._prevCondition = true;
      this._viewContainer.createEmbeddedView(this._templateRef);
    } else if (!newCondition && (isBlank(this._prevCondition) || this._prevCondition)) {
      this._prevCondition = false;
      this._viewContainer.clear();
    }
  }
}
```

[angular/ng_if.ts at master · angular/angular](https://github.com/angular/angular/blob/master/modules/angular2/src/common/directives/ng_if.ts#L26-L41)


`ngIf`ディレクティブは、`ngIf`に与えられた値`newCondition`をもとに、要素を生成したり、削除したりします。この「生成」を行うためにテンプレートが必要なのです。つまり、`*ngIf`が付与された要素をテンプレートとして`ngIf`ディレクティブが保持していて、そのテンプレートをもとに新しい要素を複製して表示しています。
これと同じ仕組みで`*ngFor`も動作しています。`ngFor`ディレクティブの場合は生成する数が複数になるだけで、本質的には`ngIf`と何も変わりません。

`*ngIf`や`*ngFor`のように、そのディレクティブが付与された要素そのものをテンプレートとして用いるときに、`*`シンタックスによるテンプレート化が必要なのです。

### `ViewContainerRef`と`TemplateRef`
先ほど`myDirective`要素に`*`プレフィックスをつけた際に要素が消えてしまったのは、テンプレート化しただけでそのテンプレートを元に要素を作っていなかったからです。`myDirective`でもテンプレートを使えるようにしてみましょう！

テンプレート化された要素は`TemplateRef`というクラスのインスタンスとしてDIできます。`TemplateRef`は`*`プレフィックスが付けられていないとDIできないので、基本的にはディレクティブは`TemplateRef`を使用するか、しないかのどちらかを決める必要があります。(※オプショナルなDIを使って切り替えることも可能)

テンプレートだけでは要素は生成できないので、テンプレートを元に要素を作ってくれるものもDIする必要があります。それが`ViewContainerRef`です。`ViewContainerRef`はディレクティブが付与された要素「があった場所」をコンテナとして使うためのクラスです。`ViewContainerRef`と`TemplateRef`を使うことで、コンテナの中にテンプレートから生成された要素を配置することができます。

次の例では`myDirective`ディレクティブを使って、同じ要素を2個生成するようにしています。

```ts
import {Component, Directive, ViewContainerRef, TemplateRef} from 'angular2/core'

@Directive({
  selector: "[myDirective]"
})
class MyDirective {
  
  constructor(
    private _template: TemplateRef,
    private _viewContainer: ViewContainerRef
  ) {}
  
  ngOnInit() {
    for(let i = 0; i < 2; i++) {
      this._viewContainer.createEmbeddedView(this._template);
    }
  }
}

@Component({
  selector: 'my-app',
  template: `
    <div *myDirective>Hello {{name}}</div>
  `,
  directives: [MyDirective]
})
export class App {
  constructor() {
    this.name = 'Angular2'
  }
}
```

`ViewContainerRef`クラスの`createEmbeddedView`メソッドに`TemplateRef`のインスタンスを渡すと、そのテンプレートを元に要素を生成し、コンテナに埋め込んでくれます。上記コードで生成されるDOMは次のようになります。

![Kobito.Fi9CZD.png](https://qiita-image-store.s3.amazonaws.com/0/20253/99459f2b-907a-678f-b2ef-3c4846579283.png "Kobito.Fi9CZD.png")

ご覧のとおり、`my-app`のテンプレートHTMLとはまったく違う構造になっています。テンプレート化を用いたディレクティブはコンポーネント側で定義したDOM構造を容易に破壊できてしまいます。なので明示的に`*`シンタックスを使わないかぎり`TemplateRef`は得られないようになっているのです。

### `<template>`を使う方法
余談ですが、`*`シンタックスは`template`要素で置き換えることができます。つまり、`template`要素によってテンプレート化が可能だということです。

先程の`*myDirective`を使った例は`template`要素を使うと次のように書けます。

```ts
@Component({
  selector: 'my-app',
  template: `
    <template myDirective>
      <div>Hello {{name}}</div>
    </template>
  `,
  directives: [MyDirective]
})
export class App {
  constructor() {
    this.name = 'Angular2'
  }
}
```

`template`要素に`*`プレフィックスのない`myDirective`を付与し、その中にテンプレート化したいHTMLを記述します。これで先ほどとまったく同じテンプレート化が可能です。

## まとめ
Angular 2の`*`シンタックスはHTML要素のテンプレート化のためのものであり、`*ngIf`や`*ngFor`などの組み込みのディレクティブだけではなく、独自に使うことができる便利な機能です。ただし使いこなすのは簡単ではないので、コンポーネントによるビューの組み立てを身につけた後に習得して欲しい中級者向けのテクニックです。

今回のサンプルコードは [Plunker](http://plnkr.co/edit/ylBGrQhdlOZ0SunPLid6?p=preview)にあります。


+++
date = "2016-04-16T11:15:00+09:00"
title = "[日本語訳] ViewChildren and ContentChildren in Angular 2"

+++


* Original: [ViewChildren and ContentChildren in Angular 2](http://blog.mgechev.com/2016/01/23/angular2-viewchildren-contentchildren-difference-viewproviders/)
* Written by: [Minko Gechev](http://twitter.com/mgechev)
* Translated at: 04/16/2016

---

この記事ではAngular 2の **View Children** と **Content Children** の違いについて解説します。

それぞれの子要素に対して、親コンポーネントからどのようにアクセスするのかを理解し、
そして`@Component`デコレータの `providers` と `viewProviders` の2つのプロパティの違いについても述べていきます。

<!--more-->

## プリミティブの合成
まず初めに、Angular 2のコンポーネントとディレクティブの関係についておさらいしましょう。
ユーザーインタフェースを作るのに一般的なデザインは[Compositeパターン](https://ja.wikipedia.org/wiki/Composite_%E3%83%91%E3%82%BF%E3%83%BC%E3%83%B3)です。
このデザインパターンは異なるプリミティブを合成し、1つのインスタンスとして同じ方法で扱えるようにします。
関数型プラグラミングの世界では関数を合成することもできます。例えば次のように

```
map ((*2).(+1)) [1, 2, 3]
-- [4,6,8]
```

このHaskellのコードは`(*2)`と`(+1)`という2つの関数を合成し、
リスト内の各アイテム`n`に対して`n -> + 1 -> * 2`という流れで適用されます。

## UIにおける合成
ユーザーインタフェースにおいても同じことがいえます。
コンポーネントを1つの関数として見てみましょう。
各関数は順序に従って合成可能であり、結果として複雑なコンポーネントを作ることができます。

この構造は次の図で表すことができます。

![image](http://blog.mgechev.com/images/component-directive-angular2.png)

この図には2つの要素があります。

- Directive: ロジックを持った要素ですが、構造は内包していません。
- Component: 1つの要素であり、1つのディレクティブでもあります。そして複数のディレクティブを内包しています。(コンポーネントを内包することもできます)

これはつまり、次のような構造を作ることができるということです。

![image](http://blog.mgechev.com/images/component-tree-angular2.png)

上の図を見ると、コンポーネントとディレクティブによる階層構造ができていることがわかります。
末端の要素はディレクティブか、ディレクティブを内包しないコンポーネントのどちらかになります。

## Angular 2におけるコンポーネントの合成
さて、そろそろAngular 2の具体的な話をしましょう。

これから説明することをわかりやすくするために、簡単なアプリケーションを作っていきます。

```ts
// ...
@Component({
  selector: 'todo-app',
  providers: [TodoList],
  directives: [TodoCmp, TodoInputCmp],
  template: `
    <section>
      Add todo:
      <todo-input (onTodo)="addTodo($event)"></todo-input>
    </section>
    <section>
      <h4 *ngIf="todos.getAll().length">Todo list</h4>
      <todo *ngFor="var todo of todos.getAll()" [todo]="todo">
      </todo>
    </section>
    <ng-content select="footer"></ng-content>
  `
})
class TodoAppCmp {
  constructor(private todos: TodoList) {}
  addTodo(todo) {
    this.todos.add(todo);
  }
}
// ...
```

これは _Yet another MV* todo application_ です. (訳注：アプリケーションの名前なのでそのまま残しています。)

上では `todo-app` というセレクタで、テンプレートを持ったコンポーネントを定義しています。
そして、子要素として使われるディレクティブのセットを定義しています。

このコンポーネントは次のように使われます。

```html
<todo-app></todo-app>
```

これは標準的なXMLの構文なので、
開始タグと終了タグの間に任意のcontentを挿入することができます。

```html
<todo-app>
  <footer>
    Yet another todo app!
  </footer>
</todo-app>
```

## `ng-content` による基本的なcontentの表示
ここで `todo-app` コンポーネントの定義にちょっと戻りましょう。
テンプレートの最後の要素 `<ng-content select="footer"></ng-content>` に気づきましたか？
`ng-content` を使うと、そのコンポーネントの開始タグと終了タグの間に置かれたcontentを、テンプレートの中に投影することができます！
`ng-content` に与えている `select` 属性はCSSのセレクタで、contentの中から投影するものを選ぶことができます。
上の例では `footer` が `todo-app` コンポーネントの一番下に挿入されます。

もし `select` 要素を省いた場合は、content全体が投影されます。

`<todo-input>` と `<todo>` の2つのコンポーネントについては今回の話には関係ないので実装部分を省略していますが、
このアプリケーションの完成形はこんな感じになります。

![image](http://blog.mgechev.com/images/todo-app-sample.gif)

## ViewChildren と ContentChildren
ここまでは簡単でしたね！さて、ようやくView ChildrenとContent Childrenという概念を定義する準備ができました。

その定義とは、「テンプレートの中に配置された子要素を *View Children* と呼ぶ」、
そして「開始タグと終了タグの間に置かれた要素を *Content Children* と呼ぶ」です。

つまり、`todo-input` と `todo` の2つの要素は `todo-app` にとっての View Childrenであり、
`footer` はContent Childであるというわけです。

### 子要素にアクセスする
ようやく本題に入れます！2種類の子要素にどうやってアクセスし、操作するのか、その方法を見ていきましょう！

#### View Childrenを使った例
Angular 2では次のプロパティデコレータを `angular2/core` パッケージで提供しています。： 

- `@ViewChildren`
- `@ViewChild`
- `@ContentChildren` 
- `@ContentChild`

これは次のように使います。

```ts
import {ViewChild, ViewChildren, Component...} from 'angular2/core';

// ...

@Component({
  selector: 'todo-app',
  providers: [TodoList],
  directives: [TodoCmp, TodoInputCmp],
  template: `...`
})
class TodoAppCmp {
  @ViewChild(TodoInputCmp)
  inputComponent: TodoInputCmp
  
  @ViewChildren(TodoCmp)
  todoComponents: QueryList<TodoCmp>;

  constructor(private todos: TodoList) {}
  ngAfterViewInit() {
    // available here
  }
}

// ...
```

上の例では、 `@ViewChildren` と `@ViewChild` を使っています。
プロパティをデコレートすると、要素をクエリできるようになります。
上の例だと、子コンポーネントである `TodoInputCmp` を `@ViewChild`で、 `TodoCmp` を `@ViewChildren` でクエリしています。
2つのデコレータを使い分けている理由は、 `TodoInputCmp` は1つしかないので `@ViewChild` を使えますが、 `TodoCmp` は複数個が表示されるので `@ViewChildren` を使う必要があるからです。

もう一つ重要なことは、 `inputComponent` と `todoComponents` の型です。
前者のプロパティの型は `TodoInputCmp` になっています。
これはクエリした結果要素が見つからなければnullになり、見つかればそのコンポーネントのインスタンスが代入されます。
一方、 `todoComponents` プロパティの型は `QueryList<TodoCmp>` で、動的に増えたり減ったりする `TodoCmp`のインスタンスを扱えます。
`QueryList` はObservableなコレクションなので、新しく追加されたり、要素が削除された時にはイベントを発生してくれます。

**AngularのDOMコンパイラは `todo-app` コンポーネントを先に初期化し、その後子要素を初期化します。**
**つまり `todo-app` コンポーネントの初期化の間は `inputComponent` も `todoComponents` もまだ初期化されていません**
**これらは `ngAfterCiewInit` ライフサイクルフックのタイミングで使用可能になります**
 
#### Content Childrenにアクセスする
Content Childrenについてもほとんど同じルールが通用しますが、少しだけ違いがあります。
それを説明するために、 `TodoAppCmp` を使う側のルートコンポーネントを見てみましょう。

 ```ts
 @Component({
  selector: 'footer',
  template: '<ng-content></ng-content>'
})
class Footer {}

@Component(...)
class TodoAppCmp {...}

@Component({
  selector: 'app',
  styles: [
    'todo-app { margin-top: 20px; margin-left: 20px; }'
  ],
  template: `
    <content>
      <todo-app>
        <footer>
          <small>Yet another todo app!</small>
        </footer>
      </todo-app>
    </content>
  `,
  directives: [TodoAppCmp, NgModel, Footer]
})
export class AppCmp {}
```

ここでは2つのコンポーネント `Footer` と `AppCmp` を定義しています。
`Footer` は開始タグと終了タグの間に渡された要素をすべて投影します( `<footer>ここが表示されます</footer>` )
一方、 `AppCmp` は `TodoAppCmp` を使い、さらに `Footer` を開始タグと終了タグの間に渡しています。
つまり、これは我々の用語では `Footer` はContent Childであるといえます。これにアクセスするには次の例のようにします。

```ts
// ...
@Component(...)
class TodoAppCmp {
  @ContentChild(Footer)
  footer: Footer;
  
  ngAfterContentInit() {
    // this.footer is now with value set
  }
}
// ...
```

View ChildrenとContent Childrenの違いは、使っているデコレータとライフサイクルフックの種類だけです。
Content Childrenには `@ContentChild` または `@ContentChildren` デコレータを使い、
`ngAfterContentInit` ライフサイクルで使用可能になります。

## `viewProviders` と `providers`
もうほとんど説明は終わってしまいました！
最後のステップは、 `providers` と `viewProviders` の違いを理解することです。
(もしあなたがAngular 2のDIのメカニズムを理解していなければ、まず [私の本](https://www.packtpub.com/web-development/switching-angular-2) を読むといいでしょう)

さて、それでは `TodoAppCmp` の宣言部分を覗いてみましょう。

```ts
class TodoList {
  private todos: Todo[] = [];
  add(todo: Todo) {}
  remove(todo: Todo) {}
  set(todo: Todo, index: number) {}
  get(index: number) {}
  getAll() {}
}

@Component({
  // ...
  viewProviders: [TodoList],
  directives: [TodoCmp, TodoInputCmp],
  // ...
})
class TodoAppCmp {
  constructor(private todos: TodoList) {}
  // ...
}
```

`@Component` デコレータの中で `viewProviders` プロパティがセットされ、 `TodoList` サービスが渡されています。
`TodoList` サービスはすべてのTodoのアイテムを保持しているサービスです。

`TodoAppCmp` のコンストラクタでは `TodoList` をインジェクトしていますが、
これは `TodoAppCmp` コンポーネントの中で使われている他のディレクティブ(もちろんコンポーネントも)でもインジェクト可能です。
つまり、 `TodoList` は次の場所からアクセス可能です

- TodoAppCmp
- TodoCmp
- TodoInputCmp

ところが、 `Footer` コンポーネントのコンストラクタでこのサービスをインジェクトしようとすると、次のようなエラーが表示されるでしょう。

```
EXCEPTION: No provider for TodoList! (Footer -> TodoList)
```

**これは `viewProviders` によって宣言されたプロバイダはそのコンポーネントとView Childrenにだけアクセス可能になるということです**

`Footer` でも `TodoList` サービスにアクセスしたい場合は、 `viewProviders` から `providers` に変える必要があります。

### `viewProviders` はいつ使うべき？
いったいどういう時に、Content Childrenからアクセスできないように `viewProviders` を使うべきなのでしょうか？
仮にあなたがサードパーティのライブラリを作り、その中でインターナルなサービスを使うとします。
そのサービスはライブラリの内部的なAPIの一部で、他のユーザーからはアクセスさせたくないものです。
そのようなプライベートな依存性を `providers` を使って登録し、ライブラリで公開しているコンポーネントの中にユーザーがContent Childrenを渡すと、
その人はアクセスできてしまいます。
しかし、あなたが `viewProviders` を使えば、そのサービスは外からは使えなくなります。

## まとめ
この記事ではコンポーネントとディレクティブの合成の方法について解説しました。
また、View ChildrenとContent Childrenの違いと、それらにどうやってアクセスするのかについても紹介しました。

そして最後に、 `viewProviders` と `providers` の意味についても説明しました。
もしこのテーマにもっと興味がある場合は、私が書いている[Switching to Angular 2](https://www.packtpub.com/web-development/switching-angular-2)を読むことをおすすめします！

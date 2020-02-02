+++
date = "2017-03-05T19:02:26+09:00"
title = "[Angular 4.0] 新しいngIfの使い方"

+++

Angular 4.0にはいくつかの新しい機能が追加されます。
今回は`ngIf`に追加される新しい機能について解説します。

<!--more-->

## ngIfの新機能

### `ngIfThen`: テンプレート分離

これまでの`ngIf`で表示を切り替えられるのは、`ngIf`ディレクティブが付与された要素とその内側の要素だけでした。
Angular 4.0以降は、`ngIf`による条件付けと、その条件により制御されるテンプレートを分離できます。
次の例では、`show`プロパティが真のときに`#thenBlock`のテンプレートが描画されます。

```html
<div *ngIf="show; then thenBlock">ignored</div>
<ng-template #thenBlock>show === true</ng-template>
```

`then`テンプレートには`TemplateRef`のインスタンスを渡せます。`null`のときは無視されます。
次の例では、条件によって`ngIf`によって描画されるテンプレートを切り替えています。
それほどユースケースは多くないですが、必要になる場面があるかもしれません。

```js
@Component({
  selector: 'ng-if-then',
  template: `
    <button (click)="switchPrimary()">Switch Template</button>

    <div *ngIf="show; then thenBlock"></div>
    <ng-template #primaryBlock>Primary</ng-template>
    <ng-template #secondaryBlock>Secondary</ng-template>
`
})
class NgIfThenElse implements OnInit {
  thenBlock: TemplateRef<any> = null;
  show: boolean = true;

  @ViewChild('primaryBlock')
  primaryBlock: TemplateRef<any> = null;
  @ViewChild('secondaryBlock')
  secondaryBlock: TemplateRef<any> = null;

  switchPrimary() {
    this.thenBlock = this.thenBlock === this.primaryBlock ? this.secondaryBlock : this.primaryBlock;
  }

  ngOnInit() { this.thenBlock = this.primaryBlock; }
}
```

### `ngIfElse`: 偽のときのテンプレート

先ほどの`then`テンプレートはこの`else`テンプレートの副産物とも言えるでしょう。
その名前のとおり、`ngIf`に渡された式が偽のときに描画されるテンプレートを指定する仕組みです。
`else`テンプレートは次のように使います。

```html
<div *ngIf="show; else elseBlock">show === true</div>
<ng-template #elseBlock>show === false</ng-template>
```

`then`テンプレートと`else`テンプレートは併用できます。


```html
<div *ngIf="show; then thenBlock; else elseBlock"></div>
<ng-template #thenBlock>show === true</ng-template>
<ng-template #elseBlock>show === false</ng-template>
```

これまでは真の場合と偽の場合にそれぞれ逆の条件の`ngIf`が必要でしたが、簡単に書けるようになります。

### `As`構文: 評価結果の変数化

これこそが`ngIf`最大の変更点です。
`ngIf`に渡された式の評価結果をローカル変数にアサインできるようになりました。
これは`async`パイプと`ngIf`を併用するケースで絶大な効果を発揮します。
次の例を見てみましょう。
非同期にユーザー情報が得られるコンポーネントで、データ取得後に`.name`プロパティを表示したいとき、
これまではこのように`async`パイプと`?.`構文を組み合わせていました。

```html
<p>{{ (user$ | async)?.name }}</p>
```

これが`.name`以外にも`.age`や`.icon`なども使いたいとなると、テンプレートは大変なことになります。


```html
<p>{{ (user$ | async)?.name }}</p>
<p>{{ (user$ | async)?.age }}</p>
<img [src]="(user$ | async)?.icon">
```

せめて`?.`をなくそうと`ngIf`で囲っても、`async`パイプは全てのバインディングに必要です。

```html
<div *ngIf="user$ | async">
    <p>{{ (user$ | async).name }}</p>
    <p>{{ (user$ | async).age }}</p>
    <img [src]="(user$ | async).icon">
</div>
```

Angular 4.0以降は、`as`を使うことで評価結果を変数として保持できます。つまり、`user$ | async`の結果であるユーザーデータを同期的に扱えるようになります。具体的には、次のように書けます。

```html
<div *ngIf="user$ | async as user">
    <p>{{ user.name }}</p>
    <p>{{ user.age }}</p>
    <img [src]="user.icon">
</div>
```

Woohoo!!!!! :tada::tada::tada::tada::tada:

この変化は単にテンプレートがきれいになるだけでなく、`async`パイプが減ることによるパフォーマンスの改善も得られます。
アプリケーションをObservableベースのリアクティブな設計したときも、テンプレートが自然に書けるようになります。

`else`テンプレートと併用すれば、今まではとても複雑になっていたテンプレートが次のようにスッキリします。

```html
<div *ngIf="user$ | async as user; else userNotFound">
    <p>{{ user.name }}</p>
    <p>{{ user.age }}</p>
    <img [src]="user.icon">
</div>
<ng-template #userNotFound>
    <p>not found</p>
</ng-template>
```

この`as`構文は`ngFor`でも使用できます。

```html
<div *ngFor="let user of (users$ | async) as users; index as i">
    <span>{{ i + 1 }} / users.length</span>
    <span>{{ user.name }}</span>
</div>
```

## まとめ

- `then`テンプレートでテンプレートの分離と切り替えが可能になる
- `else`テンプレートで偽のときのテンプレートを指定できる
- `as`による変数化で`async`パイプとの親和性が改善される

----
**Angular 4.0 Features**

- [新しいngIfの使い方](/post/ng4-feature-ngif/)
- [Metaサービスの使い方](/post/ng4-feature-meta-service/)
- [formsモジュールの更新について](/post/ng4-feature-forms-update/)
- [core/commonモジュールの変更について](/post/ng4-feature-core-update/)
- [router/http/animationsモジュールの変更について](/post/ng4-feature-libs-update/)

+++
date = "2016-04-16T00:27:46+09:00"
title = "[日本語訳] Angular 2 Component Styles"

+++
* Original: [Component Styles - ts](https://angular.io/docs/ts/latest/guide/component-styles.html)
* Written by: [angular.io](https://angular.io)
* Translated at: 04/15/2016

<!--more-->

----

# コンポーネントのスタイル

Angular 2のアプリケーションは標準のCSSによってスタイリングすることができます。
つまり、CSSのスタイルシートやセレクタ、ルールやメディアクエリなどについて知っていることをそのままAngular 2のアプリケーションに適用できます。

さらに、Angular 2はCSSのスタイルシートをモジュール化し、コンポーネントに同梱することが可能です。

この章ではどのようにして **コンポーネントスタイル** を読み込み、適用するかについて解説します。

## コンポーネントスタイルを使う
Angular 2のコンポーネントを書くとき、HTMLのテンプレートだけでなく、CSSのスタイルも決めるでしょう。
コンポーネントのテンプレートに対してスタイルを適用する1つの方法は、コンポーネントのメタデータ中の`styles`プロパティを使うことです。
`styles`プロパティはstringの配列としてCSSを受け取ります。    
  
```ts
@Component({
  selector: 'hero-app',
  template: `
    <h1>Tour of Heroes</h1>
    <hero-app-main [hero]=hero></hero-app-main>`,
  styles: ['h1 { font-weight: normal; }'],
  directives: [HeroAppMainComponent]
})
```

コンポーネントスタイルはこれまでのグローバルのスタイルとはいくつか違いが有ります。

第一に、セレクタはそのコンポーネントのテンプレート内にしか適用されません。
上の例にある`h1 { }`セレクタは、`hero-app`コンポーネントのテンプレート内にある`<h1>`タグにだけ適用され、
それ以外の他の場所には影響しません。

これは古典的なCSSとくらべてモジュール化において大きな改良点です。

1. コンポーネントのコンテキストの中で、直感的なセレクタやクラス名を使うことができます

1. クラス名やセレクタがアプリケーション中で衝突することを気にする必要がありません

1. コンポーネントのスタイルが別の場所から書き換えられることがありません

1. プロジェクトの構造が変わり、CSSのコードをTypeScriptやHTMLと同じディレクトリに置くことができます。

1. 将来的にCSSのコードを変えたり削除したりする際に、そのスタイルが他の場所で使われていないかを気にしなくてよいです


## 特殊セレクタ
コンポーネントスタイルでは[Shadow DOM](https://www.w3.org/TR/css-scoping-1/)に由来するいくつかの特殊なセレクタを使うことができます。
  
  

### `:host`
`:host`擬似クラスセレクタは、そのコンポーネント自身にマッチします。(コンポーネント内のすべての要素にヒットするわけではありません)
  
```css
:host {
  display: block;
  border: 1px solid black;
}
```

これはホスト要素にアクセスする唯一の方法です。
他のセレクタではコンポーネント自身にマッチすることはできません。
なぜならコンポーネントの要素はそのコンポーネントのテンプレートの一部ではないからです。
ホスト要素は、その親のコンポーネントのテンプレート内の要素です。

カッコとセレクタを使って表現する *関数フォーム* を使って、ホストのスタイルを状態に応じて変えることができます。
次の例では、自身に`active`クラスが付いているときだけ適用するスタイルを宣言しています。

```css
:host(.active) {
  border-width: 3px;
}
```
  
### `:host-context`
`:host-context`セレクタは、コンポーネントの *外* の状態に応じたスタイルを書くときに便利です。
例えば、CSSのテーマのクラスがドキュメントの`body`に適用されているとき、
コンポーネントのスタイルもそれに追従したい場合があるでしょう。

`:host-context`擬似クラスセレクタは、`:host`の関数フォームと同じように動作します。
コンポーネントのホスト要素の親 *すべて* に、該当するセレクタを持っていないかをチェックします。

次の例ではコンポーネント中の`<h2>`要素の`background-color`スタイルを、祖先の要素が`theme-light`を持っている時だけ変更するように書いています。

```css
:host-context(.theme-light) h2 {
  background-color: #eef;
}
```

### `/deep/`
コンポーネントスタイルは基本的に、自身のテンプレート内にしか適用されません。

ただし、`/deep/`セレクタを使うと、強制的に子コンポーネントの内部にスタイルを適用することができます。
ネストはどこまででも深く適用され、テンプレート中の子だけでなく、contentとしての子にも作用します。

次の例では、コンポーネント自身とその子すべてが持つ`<h3>`要素にマッチするCSSを書いています。

```css
:host /deep/ h3 {
  font-style: italic;
}
```

`/deep/`セレクタは`>>>`と書くこともできます。

#### 注意 
`/deep/`と`>>>`は`ViewEncapsulation.Emulated`でしか使えません。 
`ViewEncapsulation.Emulated`はコンポーネントのデフォルトの設定です。
 

## スタイルをコンポーネントへ読み込む方法
コンポーネントにスタイルを追加する方法はいくつかあります。

- テンプレートHTML中に記述する方法
- コンポーネントのメタデータで`styles`か`styleUrls`を使う方法
- CSS importsを使う方法

これまでに説明したCSSのスコーピングは、どの方法でも適用されます。

### メタデータでスタイルを読み込む
`@Component`デコレータの`styles`プロパティで、stringの配列として記述できます。

```ts
@Component({
  selector: 'hero-app',
  template: `
    <h1>Tour of Heroes</h1>
    <hero-app-main [hero]=hero></hero-app-main>`,
  styles: ['h1 { font-weight: normal; }'],
  directives: [HeroAppMainComponent]
})
```

### テンプレートインラインスタイル
テンプレートHTML中に`<style>`タグで直接埋め込むこともできます。

```ts
@Component({
  selector: 'hero-controls',
  template: `
    <style>
      button {
        background-color: white;
        border: 1px solid #777;
      }
    </style>
    <h3>Controls</h3>
    <button (click)="activate()">Activate</button>
  `
})
```

### StyleのURLをメタデータに記述する
外部のCSSファイルを`styleUrls`として記述することができます。

```ts
@Component({
  selector: 'hero-details',
  template: `
    <h2>{{hero.name}}</h2>
    <hero-team [hero]=hero></hero-team>
    <ng-content></ng-content>
  `,
  styleUrls: ['app/hero-details.component.css'],
  directives: [HeroTeamComponent]
})
export class HeroDetailsComponent {
```

#### 注意
このURLは、`index.html`から見た相対パスであり、コンポーネントのファイルから見た相対パスではありません。

#### Webpackの場合
Webpackを使っている場合は、外部CSSを使いつつ`styles`プロパティを使用することもできます。

```
styles: [require('my.component.css')]
```

こうすることで、バンドル時にCSSの読み込みが完了します。


### Linkタグによる読み込み
さらに、`<link>`タグでCSSファイルを読み込むこともできます。

```ts
@Component({
  selector: 'hero-team',
  template: `
    <link rel="stylesheet" href="app/hero-team.component.css">
    <h3>Team</h3>
    <ul>
      <li *ngFor="#member of hero.team">
        {{member}}
      </li>
    </ul>`
})
```

この場合、`styleUrls`と同じように、アプリケーションのルートからの相対パスで記述します。

### CSS @importsによる読み込み
最後に、コンポーネントスタイルではCSS標準の[`@import`ルール](https://developer.mozilla.org/en/docs/Web/CSS/@import)を使うこともできます。

```css
@import 'hero-details-box.css';
```

## ビューのカプセル化をコントロールする： Native, Emulated, None
ここまでに述べたように、コンポーネントのCSSスタイルはカプセル化されています。
Angular 2では、コンポーネントごとに、スタイルのカプセル化の設定を行うことができます。現在は3つの選択肢があります


- `Native`：カプセル化にブラウザのネイティブ実装の[Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Shadow_DOM)を使います。
コンポーネントのテンプレートHTMLは、Shadow DOM内に描画されます。

- `Emulated`：(デフォルト)Shadow DOMの振る舞いをエミュレートし、描画後の要素に適切なクラスや属性を自動で付与して擬似的にカプセル化します。

- `None`：Angularによるカプセル化を行いません。
これまでに述べたスコーピングは適用されず、グローバルなスタイルが直接影響します。

これらはコンポーネントのメタデータにある`encapsulation`プロパティにセットします。

```ts
// warning: few browsers support shadow DOM encapsulation at this time
encapsulation: ViewEncapsulation.Native
```

`Native`はブラウザがShadow DOMを実装している時だけ動作します。
Shadow DOMはまだサポートが進んでいないため、多くの場合ではデフォルトの`Emulated`を使うことをおすすめします。

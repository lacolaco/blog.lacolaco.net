---
title: 'Angular ElementsによるAngularJSの段階的アップグレード戦略'
slug: 'upgrading-angularjs-app-with-angular-elements'
icon: ''
created_time: '2019-08-18T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
tags:
  - 'Angular'
  - 'Angular Elements'
  - 'AngularJS'
  - 'Web'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Elements-AngularJS-f19ec1718d0c4245becbad06777044f5'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では Angular のコンポーネントを Web 標準の Custom Elements に変換する **Angular Elements** 機能を使い、AngularJS アプリケーションを段階的に Angular に置き換えていく手段を解説する。

先行事例として以下の記事を参考にした。

[Upgrading AngularJS to Angular using Elements](https://blog.nrwl.io/upgrading-angularjs-to-angular-using-elements-f2960a98bc0e)

[How Capital One is Using Angular Elements to Upgrade from AngularJS](https://medium.com/capital-one-tech/capital-one-is-using-angular-elements-to-upgrade-from-angularjs-to-angular-42f38ef7f5fd)

# Web Components / Custom Elements

Web 標準となったブラウザ API。 独自の HTML 要素を定義して HTML タグとして利用できる。

https://www.webcomponents.org/

HTML 要素は `HTMLElement` クラスを継承したサブクラスとして定義する。そしてクラスを `window.customElements.define` API でタグ名と共に登録する。

独自要素のタグ名は標準要素と区別するために ハイフンを 1 つ以上含むことが仕様で定められている

```
class MyElement extends HTMLElement {}

window.customElements.define("my-element", MyElement);
```

モダンブラウザでは Edge 以外で実装が終わっている。Edge や IE11、Safari に関しても Polyfill を使って擬似的に利用できる。

https://github.com/webcomponents/webcomponentsjs#browser-support

![image](/images/upgrading-angularjs-app-with-angular-elements/Untitled.728536a437f7e026.png)

![image](/images/upgrading-angularjs-app-with-angular-elements/Untitled_1.66bff369eea5edae.png)

# エントリポイントとしての Custom Elements

Custom Elements は Web 標準の機能であり、アプリケーションのフレームワークライブラリによらず使える。そして Custom Elements の内外は HTML タグとしてのプリミティブなインターフェースで分断される。つまり、ある種のシステム境界として Custom Elements を使うことができる。

端的に言えば、独自タグの外側が AngularJS で、内側で React を使ったとしても、お互いのことは関心外にできる。

```
const MyComp = () => <div>My Component</div>;

class MyElement extends HTMLElement {

    constructor() {
    super();
    ReactDOM.render(<MyComp />, this);
  }
}

window.customElements.define('my-element', MyElement);
```

あるいは lit-html を使って次のようにも書ける。

```
import { html, render } from 'lit-html';

const myComp = () => html`<div>My Component</div>`;

class MyElement extends HTMLElement {

    constructor() {
    super();
    render(myComp(), this);
  }
}

window.customElements.define('my-element', MyElement);
```

属性を経由して外からデータを受け取ることも当然できるし、イベントを外に発火することもできる。ここでは割愛するが、属性の値取得は 1 回だけでなく変更を監視することもできる。

```
const MyComp = (props) => <button onClick={props.onClick()}>{ props.label }</button>;

class MyElement extends HTMLElement {

    get label() {
        return this.getAttribute('data-label');
    }

    constructor() {
    super();
    ReactDOM.render(<MyComp label={this.label} onClick={() => this.emitEvent()} />, this);
  }

    emitEvent() {
        const event = new Event('myEvent');
        this.dispatchEvent(event);
  }
}

window.customElements.define('my-element', MyElement);
```

# Angular Elements

Angular Elements とは、Angular の Component を Custom Element に変換する機能である。

[https://angular.jp/guide/elements](https://angular.jp/guide/elements)

上述の例では React のコンポーネントを Custom Elements で wrap するコードを書いたが、Angular Elements はそれを自動的に行なってくれる。

レンダリングだけでなく、Custom Elements の属性を Angular Component の `Input` に接続し、 `Output` から `dispatchEvent` に接続してくれる。

```
import { createCustomElement } from '@angular/elements';
import { MyComponent } from './my-component';

const MyElement = createCustomElement(MyComponent);

window.customElements.define('my-element', MyElement);
```

Angular Elements はコンポーネント自身は Custom Elements 化されることを意識しなくていい。

AngularJS から Angular への移行をコンポーネント単位で行いながら移行が終わったあとはそのまま Angular アプリケーション内でコンポーネントとして利用できる。シームレスな Angular 移行に最適なアプローチと言える。

# Demo

以下のデモでは、AngularJS アプリケーション中に `<app-counter>` タグを配置している。アップグレードしたい領域を独自タグで囲むが、Custom Elements が登録されるまではただの未知タグとしてブラウザは無視するので既存アプリケーションに影響がない。

`window.enableAngular` フラグを有効にすると、Angular Elements で `<app-counter>` タグに `CounterComponent` を適用する。すると Angular コンポーネントがレンダリングされ、タグの内側のノードを置き換えてくれる。

[https://stackblitz.com/edit/angularjs-angular-elements-poc?embed=1&file=src/index.html](https://stackblitz.com/edit/angularjs-angular-elements-poc?embed=1&file=src%2Findex.html)


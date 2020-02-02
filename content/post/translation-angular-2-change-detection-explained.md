+++
date = "2016-04-10T10:50:17+09:00"
title = "[日本語訳] Angular 2 Change Detection Explained"
+++

* Original: [Angular 2 Change Detection Explained](http://blog.thoughtram.io//angular/2016/02/22/angular-2-change-detection-explained.html)
* Written by: [Pascal Precht](http://twitter.com/PascalPrecht)
* Translated at: 2/23/2016

<!--more-->

----
[NG-NL](http://ng-nl.org)はとても素晴らしかったです!
私はAngular 2のChange Detectionについての話ができて光栄でしたし、多くの参加者に気に入っていただけて大成功だったようです。
この記事では、どのようにAngularのChange Detectionが動作しているのか、どうすればそれを高速化できるのかについて誰でも読めるようにするため、
発表の内容を文章に書き起こしたいと思います。
もしこの話に興味を持ったなら、[こちらのスライド](http://pascalprecht.github.io/slides/angular-2-change-detection-explained/#/)
を見ることができますし、発表の録画も近いうちに公開されるのでそれを見ることもできるでしょう。

それでは見ていきましょう。

## Change Detectionとは何なのか？
Change Detectionの基本的な役割は、プログラムの内部の状態を取得し、それを何らかの方法でユーザーインターフェースに可視化することです。
この状態はオブジェクトや配列、プリミティブなど、JavaScriptにおけるあらゆるデータ構造になりえます。

状態はユーザーインターフェースの中でパラグラフやフォーム、リンク、ボタンとなるかもしれません。
具体的に言えば、それはWeb上でDOMとなります。
つまり、私たちは基本的にデータを入力として取得し、DOMを生成してユーザーに見せています。
このプロセスを私たちはレンダリングと呼んでいます。

![cd-4](/img/angular-2-change-detection-explained/cd-4.png)

しかし、レンダリングは実行時に変更が起きた時、トリッキーになります。
DOMが描画されてからしばらく経ったあとのことです。
私たちはどのようにして、モデルの変更と、更新しなければならないDOMの位置を知るのでしょうか？
DOMツリーへのアクセスは常にコストが高いので、更新する位置を探すだけではなく、なるべく小さなアクセスに留めたいですね。

これには多くの異なった方法で取り組むことができます。
例えば、一つの方法は単純にHTTPのリクエストを送り、ページ全体を再描画することです。
別のアプローチはDOMの古い状態と新しい状態を比較して、違う部分だけを描画する方法で、
これはReactJSが仮想DOMを使って行っていることです。

もしあなたが他のフレームワークがこの問題をどう解決しているかに興味を持っているなら、
私たちは[Tero](http://twitter.com/teropa)が書いた素晴らしい記事 [Change and its detection in JavaScript frameworks](http://teropa.info/blog/2015/03/02/change-and-its-detection-in-javascript-frameworks.html)
をおすすめします。
この記事ではAngular 2だけに注目していきます。

基本的にChange Detectionのゴールは、データとその変更を常に投影することです。

## 何が変更を引き起こすのか？
さて、私たちはChange Detectionとは何かについて知りましたが、不思議に思うかもしれません。
実際にはどんなときに変更が起こるのでしょうか？
その変更がビューを更新する必要があると、Angularはいつ知るのでしょうか？
さあ、次のコードを見てきましょう。

```ts
@Component({
  template: `
    <h1>{{firstname}} {{lastname}}</h1>
    <button (click)="changeName()">Change name</button>
  `
})
class MyApp {
firstname:string = 'Pascal';
  lastname:string = 'Precht';

changeName() {
    this.firstname = 'Brad';
    this.lastname = 'Green';
  }
}
```

もしこれがあなたが見る初めてのAngular 2のコンポーネントであれば、
[building a tabs component](http://blog.thoughtram.io/angular/2015/04/09/developing-a-tabs-component-in-angular-2.html)
を読んだほうがいいかもしれません。

上のコンポーネントはシンプルに2つのプロパティを表示し、
テンプレート内のボタンがクリックされた時にそれらを変更するメソッドを提供しています。
ボタンがクリックされた瞬間、アプリケーションの状態が変更されます。
なぜならコンポーネントのプロパティを変更しているからです。
その瞬間が、私たちがビューを更新したい瞬間です。

こちらも見てください。

```ts
@Component()
class ContactsApp implements OnInit{
contacts:Contact[] = [];

constructor(private http: Http) {}

ngOnInit() {
    this.http.get('/contacts')
      .map(res => res.json())
      .subscribe(contacts => this.contacts = contacts);
  }
}
```

このコンポーネントはコンタクトのリストを持ち、初期化時にHTTPリクエストを処理しています。
リクエストが返ってきたらリストが更新されます。
ここで、もう一度アプリケーションの状態が変わっています。
私たちはここでビューを更新したいです。

基本的に、アプリケーションの状態は次の3つの出来事で変わります。

* **イベント** - `click`, `submit`, ...
* **XHR** - サーバーからデータを取得する
* **タイマー** - `setTimeout()`, `setInterval()`

これらはすべて非同期的です。
ここから導かれる結論は、
非同期的な処理が行われた後にはいつでも、アプリケーションの状態が変わっている可能性があるということです。
これがAngularにビューを更新するように教えなければいけないタイミングです。

## 誰がAngularに伝えるのか？
さあ、私たちは今、何がアプリケーションの状態を変えるのかを知りました。
しかしこの特定の瞬間にビューを更新するように、Angularに伝えているのは何なのでしょうか？

Angularは私たちに標準のAPIを直接使わせてくれます。
AngularにDOMを更新するように伝えるために呼び出さないといけない割り込みのメソッドはありません。
これは魔法でしょうか？

もしあなたが私たちの前回の記事を読んでいたら、
それが[Zones](http://blog.thoughtram.io/angular/2016/01/22/understanding-zones.html)のおかげであることを知っているでしょう。
事実、Angularは[Zones in Angular 2](http://blog.thoughtram.io/angular/2016/02/01/zones-in-angular-2.html)という記事で書いた
`NgZone`と呼ばれる自身のZoneを備えています。ぜひこれも読んでください。

要約すると、Angularのソースコードのどこかに`ApplicationRef`と呼ばれるものがあり、
それが`NgZones`の`onTurnDone`イベントを受信しているということです。
このイベントが発火されるたびに、`AppicationRef`が実際にChange Detectionを処理している`tick()`関数を実行します。

```ts
// very simplified version of actual source
class ApplicationRef {

  changeDetectorRefs:ChangeDetectorRef[] = [];

  constructor(private zone: NgZone) {
    this.zone.onTurnDone
      .subscribe(() => this.zone.run(() => this.tick());
  }

  tick() {
    this.changeDetectorRefs
      .forEach((ref) => ref.detectChanges());
  }
}
```

## Change Detection
OK、いいですね、私たちはChange Detectionがいつ実行されるのかを知りました。
ですが、どのように処理されるのでしょうか？
ええ、Angular2において、まず私たちが知る必要があることは、
**それぞれのコンポーネントがそれぞれのChange Detectorを持っている** ということです。

![cd-tree-2](/img/angular-2-change-detection-explained/cd-tree-2.png)

これは重大な事実です、なぜならそれぞれのコンポーネントについて個別に、
いつどのようにChange Detectionを処理するかをコントロールできるようにしてくれるからです。
詳しくは後で話します。

私たちのコンポーネントツリーのどこかでイベントが起きた、例えばボタンがクリックされたと仮定しましょう。
次に何が起きるでしょうか？
私たちはちょうどZoneが与えられたハンドラーを実行し、
ターンが終了した時にAngularに伝え、
それが最終的にはAngularにChange Detectionを処理させることを学びました。

![cd-tree-7](/img/angular-2-change-detection-explained/cd-tree-7.png)

それぞれのコンポーネントが自身のChange Detectorを持っていて、
しかもAngularアプリケーションはコンポーネントツリーで構成されているので、
当然の結果として私たちは **Change Detectorツリー** も持っています。
このツリーはデータが常に上から下に流れている有向グラフとしてみることもできます。

なぜデータが上から下に流れるのか、
それはルートコンポーネントから始まったChange Detectionが、
毎回ひとつひとつコンポーネントごとに上から下へ処理されるからです。
一方向のデータフローはサイクルよりも予測しやすいので素晴らしいです。
私たちは常にビューの中で使われているデータがどこから来たのかを知っています。
なぜならそれはそのコンポーネントの中からしか来ないからです。

もう一つの興味深い観察点は、Change Detectionは一度通過した後は安定になるということです。
これは、もしコンポーネントのうちのひとつが
Change Detectionが処理されている間に何らかの副作用を追加で引き起こした時には
Angularがエラーを起こす、ということを意味します。

## 高速化
デフォルトでは、もし私たちがすべてのコンポーネントをイベントのたびに毎回チェックする必要があったとしても、
Angularはとても速いです。
Angularは数百万個のチェックを数msで実行できます。
これは主に、**AngularがVMフレンドリーなコードを生成している** という事実に起因します。

これはどういう意味でしょうか？
そうですね、私たちはそれぞれのコンポーネントが自身のChange Detectorを持っていると言いました。
それはそれぞれの個別のコンポーネントのChange Detectionを世話するための
単一の一般的なものがAngularにあるということではありません。

なぜならどんなモデル構造であってもすべてのコンポーネントをチェックできるためには、
Change Detectorはダイナミックに書かれなければならないからです。
このような種類のコードは最適化できないため、VMは好みません。
オブジェクトの形は常に同じではないため、これは **ポリモーフィック** と考えられます。

それぞれのコンポーネントごとに、**Angularは実行時にChange Detectorのクラスを生成します**。
それらはそのコンポーネントの形を絶対知っているため、モノモーフィックです。
VMはこのコードを完全に最適化可能で、とても高速に実行できます。
これの良い所は、Angularが自動的にやってくれるので私たちがこのことについて考慮する必要がないことです。

このことについてさらに深い説明が欲しければ、[Victor Savkin](http://twitter.com/victorsavkin)の
[Change Detection Reinvented](https://www.youtube.com/watch?v=jvKGQSFQf10)をチェックしてください。

## スマートなChange Detection
繰り返しますが、Angularはすべてのコンポーネントをイベントが起こるたびに毎回チェックする必要があります。
なぜなら…そう、アプリケーションの状態が変わっているかもしれないからです。
しかし、もしアプリケーションの状態が変わっていないとわかっている時、
アプリケーションの一部についてChange Detectionを実行**しない**ようにAngularに教えられたら
すばらしいと思いませんか？

そうです、その通り、それは可能です！
そこには、変更の有無を保証してくれるデータ構造、
**Immutables**と**Observables**があることがわかります。
これらの構造や型を使い、それをAngularに教えれば、
Change Detectionはもっともっと速くなります。
かっこいいですね。でもどうやるんでしょうか？

**可変性を理解する**
例えばイミュータブルなデータ構造がなぜ、どのように、手助けできるのかを理解するために、
私たちは可変性が意味することを理解しなければなりません。
次のようなコンポーネントがあると仮定しましょう。

```ts
@Component({
  template: '<v-card [vData]="vData"></v-card>'
})
class VCardApp {

  constructor() {
    this.vData = {
      name: 'Christoph Burgdorf',
      email: 'christoph@thoughtram.io'
    }
  }

  changeData() {
    this.vData.name = 'Pascal Precht';
  }
}
```

`VCardApp`は`<v-code>`を子コンポーネントとして使い、それは`vData`というInputプロパティを持っています。
私たちは`VCardApp`が持っている自身の`vData`を使ってそのコンポーネントにデータを渡しています。
`vCard`は２つのプロパティと、`vData`の名前を返すメソッド`changeData()`を持っています。
ここには何のマジックもありません。

重要な部分は、`changeData()`が`vData`を`name`プロパティを変更することで変化させていることです。
たとえそのプロパティが変わっても、`vData`の参照は同じままです。

`changeData()`を実行するなんらかのイベントが発生したと仮定すると、
Change Detectionが実行されたとき何が起こるでしょうか？
最初に、`vData.name`が変更され、それが`<v-card>`に渡ります。
その時`<v-card>`のChange Detectorは与えられた`vData`がまだ以前と同じかどうかをチェックし、同じになります。
参照は変わっていませんが、しかし、`name`プロパティは変わっているので、
AngularはChange Detectionをそのオブジェクトのために実行します。

デフォルトではJavaScriptにおいてオブジェクトは可変(プリミティブを除いて)であるため、
Angularは保守的にならざるを得ず、
イベントが起こると毎回すべてのコンポーネントでChande Detectionを走らせなければなりません。

ここでイミュータブルなデータ構造の出番です。

## 不変オブジェクト

イミュータブルなオブジェクトは変化しないという保証を私たちに与えてくれます。
それは、もし私たちがイミュータブルなオブジェクトを使い、それを変更したければ、
必ず新しい参照が得られ、もとのオブジェクトは不変であるということを意味します。

この擬似コードで見てみましょう。

```ts
var vData = someAPIForImmutables.create({
              name: 'Pascal Precht'
            });

var vData2 = vData.set('name', 'Christoph Burgdorf');

vData === vData2 // false
```

`someAPIForImmutables`はイミュータブルなデータ構造を使いたいときに使う任意のAPIです。
しかし、ご覧のとおり、私たちは簡単に`name`プロパティを変更することができません。
特定の変更と共に新しいオブジェクトが得られ、新しい参照を持っています。
単純に言えば、**変化があれば新しい参照を得る**ということです。

## チェックの回数を減らす
AngularはInputプロパティに変化がないときにサブツリーのChange Detectionをスキップできます。
私たちはこの「変化」が「新しい参照」を意味することを学びました。
もしイミュータブルなオブジェクトをAngularアプリケーションの中で使えば、
入力が変わっていないとき、
私たちがやるべきはAngularにコンポーネントがChange Detectionをスキップできることを教えることだけです。

`<v-card>`を見てそれがどうやって動くのか見てみましょう。

```ts
@Component({
  template: `
    <h2>{{vData.name}}</h2>
    <span>{{vData.email}}</span>
  `
})
class VCardCmp {
  @Input() vData;
}
```

ご覧のとおり、`VCardCmp`は自身のInputプロパティだけに依存しています。素晴らしいです。
私たちはAngularに、このようにChange Detectionの戦略を`OnPush`にセットすることで、
自身のInputに変化がないときは子ツリーのChange Detectionをスキップしていいということを伝えられます。

```ts
@Component({
  template: `
    <h2>{{vData.name}}</h2>
    <span>{{vData.email}}</span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
class VCardCmp {
  @Input() vData;
}
```

これで終わりです！
大きなコンポーネントツリーをイメージしてください。
イミュータブルなオブジェクトが使われ、それがAngularに伝わったとき、私たちは
サブツリーすべてをスキップできます。

![cd-tree-8.png](/img/angular-2-change-detection-explained/cd-tree-8.png)


[Jurgen Van De Moere](http://twitter.com/jvandemo)は
[in-depth article](http://www.jvandemo.com/how-i-optimized-minesweeper-using-angular-2-and-immutable-js-to-make-it-insanely-fast/)で
彼がどのようにAngular 2とImmutable.jsを使って驚くほど高速なマインスイーパーを作ったのかを書いています。
ぜひチェックしてください。

## Observables
先に述べたように、Observablesも変化があったことを保証してくれます。
イミュータブルなオブジェクトと違い、
Observablesは変更があっても新しい参照は与えられません。
代わりに、変更に反応するために購読することができるイベントを発火してくれます。

さて、Observablesを使い、サブツリーのChange Detectionをスキップするために`OnPush`を使いたい場合、
オブジェクトの参照は絶対に変わらないのにどうするのでしょうか？
そのようなときに必要なもの、
つまり、コンポーネントツリーの中で特定のイベントをチェックするための経路を有効にする
**とてもスマートな**方法をAngularが持っているということを明らかにします。

それが意味するものを理解するために、、このコンポーネントを見てみましょう。

```ts
@Component({
  template: '{{counter}}',
  changeDetection: ChangeDetectionStrategy.OnPush
})
class CartBadgeCmp {

  @Input() addItemStream:Observable<any>;
  counter = 0;

  ngOnInit() {
    this.addItemStream.subscribe(() => {
      this.counter++; // application state changed
    })
  }
}
```

ショッピングカートがあるeコマースアプリケーションを作るとしましょう。
ユーザーが商品をショッピングカートに入れるたびに、
小さなカウンターをUI上に出し、
ユーザーがカートの中の商品の数を見られるようにします。

`CartBadgeCmp`はまさにそれをやっています。
`counter`と、カートに商品が追加されるたびに発火されるイベントのStreamである、
Inputプロパティの`addItemStream`を持っています。

私たちはこの記事ではObservablesがどのように働くのか詳しくは触れません。
もしObservablesについて詳しく知りたいなら、
[taking advantage of Observables in Angular 2](http://blog.thoughtram.io/angular/2016/01/06/taking-advantage-of-observables-in-angular2.html)
を読んでください。

また、私たちはChange Detectionのストラテジーを`OnPush`にセットし、
毎回ではなくコンポーネントのInputプロパティが変わったときだけChange Detectionが働くようにします。

しかし、先述の通り`addItemStream`の参照は変わることはなく、
このコンポーネントのサブツリーのChange Detectionは全く実行されません。
このコンポーネントは`ngOnInit`ライフサイクルフックの中でストリームを購読し、
カウンターを加算しているので、これは問題です。
これはアプリケーションの状態の変化であり、
ビューに反映させたいと思いますよね？

これが私たちの(**すべて**を**OnPush**に設定した)Change Detectorツリーの見え方です。
イベントが起きてもChange Detectionは全く動作しません。

![cd-tree-10](/img/angular-2-change-detection-explained/cd-tree-10.png)

どうすればAngularに変更を知らせることができるでしょうか？
どうすればたとえツリー全体が`OnPush`にセットされていても、
このコンポーネントはChange Detectionの実行が**必要**だとAngularに知らせることができるでしょうか？

ご心配なく、Angularはちゃんとカバーしています。
先ほど学んだように、Change Detectionは**常に**上から下に動作します。
そして私たちがやらないといけないのは、
変更が起きたコンポーネントまでのツリーの経路の変化を検知する方法です。
Angularはその経路がわかりませんが、私たちにはわかります。

私たちは[dependency injection](http://blog.thoughtram.io/angular/2015/05/18/dependency-injection-in-angular-2.html)を通じて、
`markForCheck()`というAPIを備えたコンポーネントの`ChangeDetectorRef`にアクセスできます。
このメソッドがまさに私たちが求めているものです！
これは次のChange Detectionでチェックされるために、ルートからコンポーネントまでの経路をマークします。

さあコンポーネントに注入してみましょう。


<p>Let’s inject it into our component:</p>

```ts
constructor(private cd: ChangeDetectorRef) {}
```

そして、チェックされるためにこのコンポーネントからルートまでの経路をAngularに伝えます。

```ts
  ngOnInit() {
    this.addItemStream.subscribe(() => {
      this.counter++; // application state changed
      this.cd.markForCheck(); // marks path
    })
  }
```

Boom,これだけです！
これはObservableのイベントが発火されたあと、Change Detectionが始まる前です。

![cd-tree-12](/img/angular-2-change-detection-explained/cd-tree-12.png)

そして、Change Detectionが実行されると、シンプルに上から下へと進んでいきます。

![cd-tree-13](/img/angular-2-change-detection-explained/cd-tree-13.png)

クールですよね？一度Change Detectionが走った後は、ツリー全体は`OnPush`状態に戻ります。

## もっと詳しく
実際にはこの記事ではカバーしきれないたくさんのAPIがありますが、
スライドや発表の録画を見るといいでしょう。

また、[リポジトリ](https://github.com/thoughtram/angular2-change-detection-demos)には
あなたのローカルマシンで試すためのいくつかのデモがあります。

イミュータブルなデータ構造やObservableがどのようにAngularのアプリケーションを速くできるのかについて
もう少し明らかにしました。

## 謝辞
この発表を準備するにあたって、**多大な**助けと支援となった
[Jurgen Van De Moere](http://twitter.com/jvandemo)に感謝したい。
彼は私の理解について議論するのに多くの時間を費やし、
このコンテンツに入っている私を助ける良い質問を沢山挙げてくれました。
また、彼はデモがよく動くように確認してくれました。
彼のCSSスキルは素晴らしいです。
Jurgen、そんな支えになるいい人であることにとてもとても感謝します。

Angular 2のChange Detectionについての質問にたくさん答えてくれた
[Victor Savkin](http://twitter.com/victorsavkin)と彼が書いた
とても参考になる記事に感謝したい。
ありがとうVictor！

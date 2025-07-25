---
title: 'Custom ElementsとEventTargetの話'
slug: 'custom-elements-event-target'
icon: ''
created_time: '2018-04-25T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Web Components'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Custom-Elements-EventTarget-5a42f600d9194260a6a894cfdc3fbe3d'
features:
  katex: false
  mermaid: false
  tweet: false
---

Shadow DOM の Hayato Ito さんと、Custom Elements と EventTarget についてちょっと議論できた話。（ありがとうございました！）

---

先日、Web Components Cafe で登壇しました。

https://slides.com/laco/angular-webcomponents-20180423/

最近自分の中で Custom Elements の盛り上がりが強くて、 単純な Presentational なコンポーネントだけじゃなく、 ある程度の機能を備えたマイクロアプリケーションとしての Custom Elements をどう設計・運用するか、みたいなところを考えてる。

## イベントの話

Custom Elements で分断されたマイクロアプリケーション間でコミュニケーションしようとすると、当然それらの外側にある何かを介するしかなくて、 現実的には何かしらのイベントバスが必要になる。パッと思いつくのは `window` をイベントバスとして使うケース。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180425/20180425101709.png)

これには問題があって、イベントは文字列で識別されるので、未知のタグやスクリプトから同じ名前のイベントが通知されるおそれがある。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180425/20180425101949.png)

これを解決するためには、そのドメインに閉じた scoped なイベントバスが欲しいという話。

## CustomElementRegistry

で、そのスコープって今仕様が議論されている CustomElementRegistry と同じ粒度なんじゃないかと思い、 GitHub に*EventTargetRegistry*みたいなものがあると良いのでは！？というコメントを書いてみた。

> I think scoped root EventTarget also will be needed. Separated elements can only communicate each other via its outer event bus, window. Events are identified by its name as well as elements. So, as the same idea, I guess something like EventTargetRegistry will be important.

[https://github.com/w3c/webcomponents/issues/716#issuecomment-383540589](https://github.com/w3c/webcomponents/issues/716#issuecomment-383540589)

今思うとかなりふわふわしてるコメントだけど、ありがたいことに Shadow DOM の Hayato Ito さんが返信してくれた

> @lacolaco Could you kindly give us an example how scoped root EventTarget works? Pseudo-code snippet might be helpful to understand the basic idea.
>
> I think I can understand what problem you are trying to solve, but it is unclear to me how EventTargetRegistry works.

[https://github.com/w3c/webcomponents/issues/716#issuecomment-383780403](https://github.com/w3c/webcomponents/issues/716#issuecomment-383780403)

改めてユースケースを考えてみると、新しい Registry が必要なことはなくて、CustomElementRegistry そのものが EventTarget になってくれたらよさそうだった。

> @hayatoito Just an idea, for example, I think CustomEelementRegistry can be an EventTarget.

```
const xRegistry = new CustomElementRegistry();class XFoo extends HTMLElement {  constructor() {    super();    this.addEventListener("click", () => {      // dispatch a scoped event      xRegistry.dispatchEvent(new CustomEvent("xEvent"));    });  }}class XBar extends HTMLElement {  constructor() {    super();    // subscribe scoped events    xRegistry.addEventListener("xEvent", () => {      // ...    });  }}xRegistry.define("x-foo", XFoo);xRegistry.define("x-bar", XBar);
```

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180425/20180425104452.png)

これには Hayato Ito さんも同意してくれたんだけど、実は `EventTarget` って普通に new できることを教えてくれた。

> Thanks. Just in case, EventTarget is now constructible. Users can create their own EventTarget and use it for any purpose.

これ知らなかったのですべてひっくり返って「これでいいじゃん（いいじゃん）」になった。ありがとうございます。

## new EventTarget()

window や document、Element など `addEventListener`できるオブジェクトはみんな`EventTarget`インターフェースを実装しているんだけど、 実は去年の whatwg DOM Standard のアップデートで、開発者が自由に`new EventTarget()` できるようになってた。知らなかった。

ついでにいえば、サブクラスを作ることもできるようになってた。知らなかった。

[https://dom.spec.whatwg.org/#dom-eventtarget-eventtarget](https://dom.spec.whatwg.org/#dom-eventtarget-eventtarget)

https://github.com/whatwg/dom/commit/c4c1c8b47340a1e5ecc1a07670927b831f240586

MDN にも項目があった。知らなかった。

[https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget](https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/EventTarget)

ただ、ブラウザの実装状況はまだそれほどよくない。まだ使いづらい。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180425/20180425103928.png)

## まとめ

- CustomElementRegistry が EventTarget になったら直感的な気がする
- EventTarget は new できる
- 現状は自前で EventBus 作る感じになりそう。

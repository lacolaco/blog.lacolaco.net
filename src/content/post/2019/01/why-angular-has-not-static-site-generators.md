---
title: 'Angular Elementsの野望と、Angularに静的サイト用フレームワークがない理由'
slug: 'why-angular-has-not-static-site-generators'
icon: ''
created_time: '2019-01-13T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'SSG'
  - 'Angular Elements'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Elements-Angular-dd51c92026ab47ba898223ae64a2a1f0'
features:
  katex: false
  mermaid: false
  tweet: false
---

「Angular って静的な Web サイトを吐き出せる技術とかないんですか」という質問を受けることがたびたびあります。 例えば Gatsby や Gridsome、Next.js、Nuxt.js などのようなものですね。 サーバーサイドレンダリングの仕組みは自体はすでに Angular Universal がありますし技術的に難しいことではないので、コミュニティのなかで Angular ベースで静的サイトを作るための新しいフレームワークが生まれてくることはあるかもしれません。 しかし僕の個人的な見解では、少なくとも Angular チームが公式に提供することはないと思っています。

ではなぜ Angular チームはそこにフォーカスしないのかということについて、今 Angular が向かっている方向と一緒に理解してみましょう。

## いまある Web に溶け込んでいく

2017 年の後半あたりから、Angular チームの主眼は静的な Web との融合になってきました。 これまで Angular は Single Page Application の開発を堅牢でスケーラブルにおこなうための一貫したフレームワークを提供してきました。 その文脈では一定の完成度に達し、開発者からも支持されるようになりましたが、Web の世界は広大で、その大半はいわゆるドキュメントとしての Web サイト、Web ページです。 WordPress をはじめとする CMS によるコンテンツが Web の大部分を構成しています。

そうした Web のなかで Angular にできることを考えた結果が、Angular Elements です。 Angular はアプリケーションではなくコンポーネントを開発するための基盤としての側面を持つようになりました。 Angular Elements によって Angular コンポーネントから Custom Elements を生成し、そのタグを静的コンテンツのなかに組み込んでいくことができます。 いまある Web をそのままに、Angular と Custom Elements がその体験を拡張していきます。

実例として、Angular の公式ドキュメンテーションサイト angular.io では、Markdown で管理されているドキュメンテーションのなかに書かれた独自タグが、Custom Elements として起動してリッチなコンテンツを提供しています。 `<code-example>` タグは Angular Elements で作られた Custom Elements として存在しています。

## heroes コンポーネントを作成する

Angular CLI を使用して､`heroes`という名前の新しいコンポーネントを生成します。

```html
<code-example language="sh" class="code-shell"> ng generate component heroes</code-example>
```

<figure>
  <img src="https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20190113/20190113000151.png" alt="code-example 要素はAngular Elementsで作られたCustom Element">
  <figcaption>code-example 要素はAngular Elementsで作られたCustom Element</figcaption>
</figure>

## 技術的な課題

Angular Elements のアプローチの概念実証として angular.io が作られましたが、バンドルサイズの課題がありました。 現状の実装では、Angular Elements が依存する Angular コアランタイムが大きく、複数の Angular Elements を Web サイトから読み込むのにパフォーマンスへの悪影響がありました。

これを解決するのが Ivy で、Ivy が導入されれば Angular Elements が依存する Angular コアランタイムを最小限にとどめ、バンドルサイズを数 KB に抑えることができるようになります。

## まとめ

今後も Angular で静的サイトを作るためのフレームワークが生まれることは、少なくとも公式にはないでしょう。 Angular チームは、いまある Web を Angular Elements で拡張していくことを目指しています。 Custom Elements はフレームワークに依存しないので、Angular Elements で作成したタグを Gatsby や Nuxt.js などで作られたサイトで利用することもできます。 タグを使う側からすれば、そのタグが Angular で作られていることは知る必要のないことです。

Angular Elements + Ivy によって、Angular Elements の開発体験とユーザ体験を高めることが 2019 年の主要なテーマのひとつです。 Angular は単なる SPA 開発フレームワークではなく、あらゆる Web のユースケースに対応できる開発プラットフォームとしてこれから進化していくことでしょう。

[追記] Nuxt.js は静的サイトジェネレータ以外の用途もあるという指摘で、冒頭の部分で誤解を生みそうな点を教えてもらったので、修正しました。

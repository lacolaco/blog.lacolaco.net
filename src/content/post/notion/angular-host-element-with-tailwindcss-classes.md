---
title: 'Angular: ホスト要素にTailwindCSSのクラスを付与する'
slug: 'angular-host-element-with-tailwindcss-classes'
icon: ''
created_time: '2023-09-06T03:58:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
tags:
  - 'Angular'
  - 'tailwindcss'
published: true
locale: 'ja'
category: 'Tech'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-host-element-with-tailwindcss-classes'
notion_url: 'https://www.notion.so/Angular-TailwindCSS-4b13c6c076da42c381d181affb15f518'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular アプリケーションで TailwindCSS を使っているとき、コンポーネントやディレクティブのホスト要素にスタイルを付与するのが書きにくくて困っていた。コンポーネントHTML内の子要素については `class` 属性にクラスを追加するだけなので、VSCodeの TailwindCSS IntelliSenseが期待通りに機能するが、ホスト要素にクラスを付与するAPIはHTMLの外なので、入力補完の効かない自由文字列で記述しなければならなかったからだ。

https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss

<figure>
  <img src="/images/angular-host-element-with-tailwindcss-classes/Untitled.b4659f6b809c1ee9.png" alt="hostメタデータのclassプロパティはTailwindCSS Extensionにクラスを記述する場所だと認識されていない">
  <figcaption>hostメタデータのclassプロパティはTailwindCSS Extensionにクラスを記述する場所だと認識されていない</figcaption>
</figure>

TailwindCSS のユーティリティファーストは入力補完があってはじめてまともに実用性があるアプローチだと考えているので、この使いにくさはAngularアプリケーションでTailwindCSSを使う上で悩みのタネだった。

これはどうにかできないかと長らく思っていたのだが、あらためてExtensionの設定項目を眺めてみると `classRegex` という設定があった。実はけっこう前から追加されているらしく、これを使えば任意の正規表現にヒットする行でIntelliSenseを有効にできる。

https://zenn.dev/shon0/articles/2aa72060fb824d

https://github.com/tailwindlabs/tailwindcss/issues/7553

そういうわけで、次のようにVSCodeの設定を記述した。 このJSONは個人設定に書いてもいいが、チーム開発なら `.vscode/settings.json` に書いておけば個別の設定なしに自動的に適用できる。

```json
{
    "tailwindCSS.experimental.classRegex": [
        "class\\:\\s*[\"'`]([^\"'`]*).*?[\"'`]"
    ]
}
```

結果、無事にコンポーネントの `host.class` プロパティでもTailwindCSSのクラス入力補完が使えるようになった。

<figure>
  <img src="/images/angular-host-element-with-tailwindcss-classes/Untitled.c68ee4d0697b108d.png" alt="classプロパティの中で TailwildCSS の入力補完が効くようになった">
  <figcaption>classプロパティの中で TailwildCSS の入力補完が効くようになった</figcaption>
</figure>

スタンドアローンコンポーネントで書くようになってから、テンプレートHTMLはインラインで書くことが増えたが、CSSもインラインで書くのにこの点だけがネックだったので、それが解決して嬉しい。


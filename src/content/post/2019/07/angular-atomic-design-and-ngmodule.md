---
title: 'AngularにおけるAtomic DesignとNgModule'
slug: 'angular-atomic-design-and-ngmodule'
icon: ''
created_time: '2019-07-11T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Atomic-Design-NgModule-544a0dd66f0b4c7dae3e7f5ba21a6320'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular の UI コンポーネントにおける NgModule の粒度についての現在の考え。

これならうまくいくのではないかという仮説であり、何度か実践はしているが自信を持って正解であるとはまだ言えない。

## 結論

次のようなディレクトリ構造と NgModule（ `xxx.module.ts` ）の配置になる。要点は以下の点。

- ライブラリ化できるのは Atoms と Molecules まで。Organisms はアプリケーション側の関心とする。
- Atoms も Molecules も個別 Module する。

```
  src
  └ lib
  　 ├ atoms
  　 │ ├ button
  　 │ │ ├ button.component.{ts,html,scss}
  　 │ │ └ button.module.ts
  　 │ └ input
  　 │ 　 ├ input.component.{ts,html,scss}
  　 │ 　 └ input.module.ts
  　 ├ molecules
  　 │ └ search-form
  　 │ 　 ├ search-form.module.ts
  　 │ 　 └ search-form.component.{ts,html,scss}
  　 └ app
  　 　 ├ app.module.ts
  　 　 └ shared
  　 　 　 └ header
  　 　 　 　 ├ header.module.ts
  　 　 　 　 └ header.component.{ts,html,scss}
```

## ライブラリとアプリケーションの境界

ライブラリとアプリケーションの境界は、アプリケーションが実現するユースケースに関心をもつかどうかで考えられる。

[Brad Frost の Atomic Design](http://bradfrost.com/blog/post/atomic-web-design/)に素直に従えば、Atoms は HTML 要素のようなプリミティブなもので、Molecules は Atoms をいくつか組み合わせた単一責任原則に従う UI パーツである。これらはコンテキストによらずどこでも使えるジェネリックな存在で、ライブラリ化する意味がある。

一方で Orgamisms より上の階層はアプリケーションのコンテキスト、ユースケース、ドメインに大いに影響を受ける。これはライブラリ化することに意味はなく、アプリケーションの中で定義されているべきものだ。

乱暴ではあるし例外もあるが、アプリケーションの中で定義するのは Organisms 以上のものだけだと決めつけてもよいくらいだと考えている。

## Atoms と NgModule

NgModule 単位でのコード分割と Lazy Loading を考えれば、それぞれの NgModule にとって必要な Molecules だけを import するほうがいい。

`ButtonModule` や `LabelModule` のように分割しよう。

## Molecules と NgModule

Atoms と同様に `MoleculesModule` は認められない。

## Organisms と NgModule

同じ理由で、 `OrgamismsModule` などもってのほかである。

アプリケーション側で定義されるが、複数の箇所で再利用されるものであればそれも `HeaderModule` のように NgModule 化しておけばコード分割しやすくなる。

## 考察

このような分割を置くと、あるコンポーネントを作るときに分類に悩むことが減る。

はじめの問いは、「この UI パーツはアプリケーションのドメイン、ユースケースに依存するか」ということである。依存するならアプリケーション側であり、依存しないならライブラリ側である。

そして次にライブラリ側であれば、それが独立して存在できるか、できないか、という問いになる。

ここまで来るとだいぶ Atomic Design とはずれてくるので、いっそ Atomic Design からは離れて分類名を変えてしまってもいいだろう。

## 懸念事項

- Dialog や Table はコンテキストを持たないように思えるが存在としては Organisms であるようにも感じる。ライブラリ側の Organisms というのも存在するのか？
  - もはや Molecules には「Atoms ではない」という意味だけを与えてしまえば Molecules で吸収できる。 Compounds（化合物）という語彙を与えてもいいかもしれない。

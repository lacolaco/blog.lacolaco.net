---
title: 'Angularコンポーネントのスタイルにemotionを使う'
slug: 'angular-component-style-with-emotion'
icon: ''
created_time: '2018-07-28T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-emotion-8db2b4c69abe4f3994f1e1bf70d145ed'
features:
  katex: false
  mermaid: false
  tweet: false
---

追記

型安全に CSS のオブジェクトを書きたいというだけなら NgStyle と`csstype`を使うだけでもよさそうだ。

[https://github.com/frenic/csstype](https://github.com/frenic/csstype)

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180728/20180728090201.png)

emotion を使うことによる利点は、

- CSS クラスにシリアライズされるので、テンプレート中で評価対象が文字列となり、Change Detection のパフォーマンス上で有利

くらいなものか。

---

今日の境界遊び。CSS in JS を Angular でやりたかった。 常識のある方は真似しないほうがよい。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180728/20180728002419.png)

今回使ったのは [https://emotion.sh/](https://emotion.sh/) .

Angular で時々困るのは styles の中にデータバインディングを置きたいケース。 たとえば、フォームの入力に応じて動的にフォントサイズを変えるようなケースを考える。

![image](https://media.giphy.com/media/3IFE4ooosgtRPJbih9/giphy.gif)

emotion の `css` 関数は、与えた CSS スタイルシートをシリアライズしてユニークな CSS クラス名に変換してくれる。 Angular のコンポーネントは HTML 要素と 1:1 に対応するので、 `[className]` プロパティにバインディングすれば emotion で生成したクラスを適用できる。

`helloClassName$` プロパティは、フォントサイズに応じた CSS スタイルシートを CSS クラス名に変換した Observable である。

```
helloClassName$ = this.form.valueChanges.pipe(
  map(({ fontSize }) => css({ fontSize }))
);
```

これをテンプレート中で次のように使えば、emotion によって動的に生成されたクラスを任意の要素に適用できる。

```html
<hello [className]="helloClassName$ | async" [name]="name"></hello>
```

ところで、Angular の `CommonModule` (@angular/common) は、 `NgClass` と `NgStyle` という 2 つのディレクティブを提供している。

[https://angular.io/api/common/NgStyle](https://angular.io/api/common/NgStyle)

[https://angular.io/api/common/NgClass](https://angular.io/api/common/NgClass)

`className`を使わずとも、次のように書くこともできる。`NgClass`は文字列以外にも文字列の配列やオブジェクトを受け取れる以外には、本質的に`className`と何も違いはない。

```html
<hello [ngClass]="helloClassName$ | async" [name]="name"></hello>
```

`NgStyle`を使う場合は、emotion ではなく生のスタイルシートっぽいオブジェクトを渡すことになる。 本来 Angular だけで CSS-in-JS やろうとするとこの API になるわけだが、emotion だと`css`関数の引数オブジェクトに TypeScript 型定義もあるし嬉しいのでは？という目論見がある。 あと emotion なら同じスタイルなら同じクラスになり、キャッシュの仕組みが強いっぽいので、パフォーマンス良くなるかもしれない。

[https://emotion.sh/docs/typescript](https://emotion.sh/docs/typescript)

```
helloStyle$ = this.form.valueChanges.pipe( map(({ fontSize }) => ({ fontSize:
`${fontSize}px` })) );

<hello [ngStyle]="helloStyle$ | async" [name]="name"></hello>
```

すべて同じ動きとなるので好みで選べばよいが、個人的には React との対称性を考えて`[className]`でよいのでは？と感じる。

実際に動くサンプルは次の通り。

https://stackblitz.com/edit/angular-emotion?embed=1&file=src/app/app.component.ts

React の場合、className は HTML 要素に対応するコンポーネントにしか使えないが、Angular の場合すべてのコンポーネントは HTML 要素に対応付けられるので、テンプレート中で親から className プロパティにバインディングするだけで子コンポーネント側でなにもしなくてもよいのは、比較的楽だなと思った。 しかし emotion で一番やりたい styled-component が React しか使えないので、これをどうにかしてみたい。

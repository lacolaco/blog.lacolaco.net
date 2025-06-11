---
title: 'Angular: CSS Gridを使ったExpansionディレクティブの実装'
slug: 'angular-expansion-directive'
icon: ''
created_time: '2023-12-18T12:24:00.000Z'
last_edited_time: '2023-12-30T09:58:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'CSS'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-CSS-Grid-Expansion-5cd15f39e63e48b7828eaf1224f8d884'
features:
  katex: false
  mermaid: false
  tweet: false
---

要素の高さを0から自動計算されたサイズとの間でアニメーションするのは一筋縄ではいかないものだったが、つい最近のブラウザのアップデートによってCSS Gridを使ったアプローチが可能になったらしい。

https://dev.to/francescovetere/css-trick-transition-from-height-0-to-auto-21de

https://coliss.com/articles/build-websites/operation/css/css-transition-from-height-0-to-auto.html

この方法をAngularアプリケーションの中で使いやすいパーツとしてディレクティブを実装してみたのが次のサンプルコードだ。実際に動作するので試してもらいたい。もし自身のプロジェクトに取り入れたいと思ったら自由にしてもらって構わない。

https://stackblitz.com/edit/angular-kyt4lx?ctl=1&embed=1&file=src/main.ts

## `Expandable` ディレクティブ

`Expandable` ディレクティブは、ディレクティブが付与されたホスト要素にスタイルを付与する。冒頭の記事で紹介されているように、エキスパンションパネルのコンテナとなる要素には `display: grid` と `grid-template-rows` を記述し、 `transition-property: grid-template-rows` でグリッド構造の変更をアニメーション可能にする。 `duration` や `timing-function` は何でもよい。

ディレクティブを使ってスタイルを付与する場合は、ホストバインディングで `style` プロパティへオブジェクトを渡してあげればよい。 `ngStyle` や `style.xxx` といった機能を使わなくとも、まとめてスタイルを付与できる。

```ts
@Directive({
  selector: '[expandable]',
  standalone: true,
})
export class Expandable {
  @Input({ alias: 'expandable' })
  isExpanded = false;

  @HostBinding('style')
  get styles() {
    return {
      display: 'grid',
      'transition-property': 'grid-template-rows',
      'transition-duration': '250ms',
      'transition-timing-function': 'ease',
      'grid-template-rows': this.isExpanded ? '1fr' : '0fr',
    };
  }
}
```

## 使い方

`Expandable` ディレクティブを任意のコンテナ要素に付与し、その直下の子要素に `overflow: hidden` スタイルを付与する。こうすることでグリッドの高さが `0fr` になったときに溢れる部分が非表示になる。

```ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [Expandable],
  template: `
    <h1>Expansion with grid-template-rows</h1>

    <button (click)="toggle()">toggle</button>
    <div [expandable]="isExpanded()" style="border: 1px solid black;">
      <div style="overflow: hidden;">
        <p>Lorem ipsum dolor sit amet, ...</p>
      </div>
    </div>
  `,
})
export class App {
  isExpanded = signal(false);

  toggle() {
    this.isExpanded.update((v) => !v);
  }
}
```

## 所感

Angular には独自のアニメーション機能もあるが、このエキスパンションパネルのユースケースではCSSだけで十分だと思う。非常に汎用性の高い仕組みだし実装も難しくないので、積極的に使っていきたいテクニックだと感じた。（そもそも `height: auto` でアニメーションできればそれに越したことはないのだが。）

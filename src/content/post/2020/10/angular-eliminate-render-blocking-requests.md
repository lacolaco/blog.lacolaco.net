---
title: 'Angular: Eliminate Render Blocking Requests の概要'
slug: 'angular-eliminate-render-blocking-requests'
icon: ''
created_time: '2020-10-01T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Eliminate-Render-Blocking-Requests-ab8e452125df4704bcc7aa3da401391d'
features:
  katex: false
  mermaid: false
  tweet: false
---

この記事では Angular CLI チームで現在進行中の “Eliminate Render Blocking Requests” というプロジェクトについてその内容を解説する。 一次ソースは以下のリンク先を参照されたし。

- [[RFC] Eliminate Render Blocking Requests · Issue #18730 · angular/angular-cli](https://github.com/angular/angular-cli/issues/18730)
- [Eliminate render-blocking resources · Issue #17966 · angular/angular-cli](https://github.com/angular/angular-cli/issues/17966)

## 概要

このプロジェクトは Angular アプリケーションが依存する CSS について、**Render-Blocking** な HTTP リクエストを無くそうというものである。 Render-Blocking なリソースの除去については web.dev の記事を参考にするとよい。

[Eliminate render-blocking resources](https://web.dev/render-blocking-resources/)

最初のレンダリングに必要な CSS の読み込み時間がなくなることで First Contentful Paint（FCP）のパフォーマンスが改善される見込みだ。

Angular CLI チームが RFC（Request For Comments）で 提案したのは次のような手法である。

- CSS ファイルの読み込みの非同期化
- Angular Universal SSR や Pre-rendering、App-Shell、通常のクライアントサイドレンダリングでのクリティカル CSS のインライン化
- Google Fonts と Icons のインライン化

これらを Angular CLI で特別な設定無しに利用できるようにすることを目的としている。

## 背景

`ng build` コマンドのビルドに使われる `styles` の CSS ファイルは基本的にリセット CSS や Theming など、ページ表示の最初に読み込まれることが期待されている。 しかし CSS は `styles.css` のような形でバンドルされ、 `<link>`タグで読み込むことになるため、この `styles.css` が肥大化するとページの First Contentful Paint（FCP）が遅くなる原因になる。 とはいえ `styles.css` の内容をすべてインライン化するのは HTML ファイルのペイロードサイズを肥大化させてしまう。

そこで、本当にクリティカルな CSS だけをインライン化し、残りの部分を非同期化することで FCP を改善しようというのが今回の趣旨である。

## 解決案

これらの手法は Angular CLI に合理的な形で組み込めるかどうかはまだ保証できないが、現時点でのアイデアとして提案されているものであり、確定事項ではない。

### CSS の非同期読み込み

バンドルされた `styles.css` が初期レンダリングに必要のないため CSS の読み込みを待たずにレンダリングを始めてよいことをブラウザに伝える。 具体的には `<link>` タグの `media` 属性を使い、印刷などの特殊なユースケースを除いた通常のユースケースでは読み込みを非同期化する。

Before

```html
<link rel="stylesheet" href="styles.css" />
```

After

```html
<link
  rel="stylesheet"
  href="styles.css"
  media="print"
  onload="this.media='all'"
/>
<noscript><link rel="stylesheet" href="styles.css" /></noscript>
```

参考: [レンダリング ブロック CSS  |  Web  |  Google Developers](https://developers.google.com/web/fundamentals/performance/critical-rendering-path/render-blocking-css)

### CSS Files Budget

CSS のダウンロードやパースの時間を短縮するため、ファイルサイズに関する新たな Budget を追加する。 実際には参照されないデッドコードの除去や、グローバル CSS ではなく適切なコンポーネントのスタイルへの移動などを促進する。

- `anyStyle`: 外部 CSS ファイル個別のサイズ
- `allStyle`: すべての外部 CSS ファイルの累計サイズ

すでに存在する`anyComponentSyle` はコンポーネント CSS のファイルサイズを対象としているので全く別物である。

### Google Fonts と Icons のインライン化

`https://fonts.googleapis.com/` から最初にダウンロードするフォント読み込みの CSS をインライン化することで HTTP リクエストのラウンドトリップを削減する。 これまでは CSS の読み込みのあとに `woff` などのフォントファイルの読み込みが行われていたが、フォントファイルの読み込みだけになる。 また、Angular CLI が参照する browserslist の設定に基づいて最適なフォントフォーマットの決定も自動的に行われる。

Before

```html
<link
  rel="stylesheet"
  href="https://fonts.googleapis.com/icon?family=Material+Icons"
/>
```

After

```html
<style>
  @font-face {
    font-family: 'Material Icons';
    font-style: normal;
    font-weight: 400;
    src: url(https://fonts.gstatic.com/s/materialicons/v55/flUhRq6tzZclQEJ-Vdg-IuiaDsNcIhQ8tQ.woff2)
      format('woff2');
  }

  .material-icons {
    font-family: 'Material Icons';
    font-weight: normal;
    font-style: normal;
    font-size: 24px;
    line-height: 1;
    letter-spacing: normal;
    text-transform: none;
    display: inline-block;
    white-space: nowrap;
    word-wrap: normal;
    direction: ltr;
  }
</style>
```

### クリティカル CSS の抽出

Render-Blocking な CSS だけをインライン化するためには CSS を解析してその部分だけを抽出する必要がある。 これをすでに実現しているプロジェクトとして、[penthouse](https://github.com/pocketjoso/penthouse)や[critters](https://github.com/GoogleChromeLabs/critters)、[critical](https://github.com/addyosmani/critical)などがある。 これらはアプリケーションを一度レンダリングし、そこで参照されたクリティカル CSS を抽出する方法をとっている。

Google Chrome チームが開発している critters は抽出のためのレンダリングにヘッドレスブラウザではなく JSDOM を用いており、 ビルド時だけでなくランタイムで動作させる選択肢としては上述のツールの中で最適であると考えられる。 ただし、critters は viewport を予測せず、ドキュメントに読み込まれたすべての CSS をインライン化してしまうトレードオフがある。

また、Angular アプリケーションのユースケースにおいてそれぞれの課題を挙げている。

### Angular Universal (SSR)

critters は webpack プラグインであるため、Node.js サーバー上で動的にビルドする Angular Universal は利用できない。 したがって、Universal を考慮すれば critters のコア機能だけを Node.js 向けに切り出したものが必要になるだろう。 うまく実現できれば、Universal でビルドした HTML の中にクリティカル CSS をインライン化してクライアントに返すことができる。

### App-Shell / Pre-rendering

Angular CLI のビルド時にあらかじめ HTML をレンダリングする App-Shell や Universal Pre-rendering のユースケースについては、critters の基本的なアプローチで解決できる。

### Client Side Rendering （CSR）

クライアントサイドレンダリングのアプリケーションは、Node.js 環境で実行できないため critters のようなツールでの クリティカル CSS 抽出ができない。 しかし Angular コンテキストではないカスタムの CSS 読み込み は `index.html` で記述されることが多いため、ビルド時にこれらを抽出してインライン化することでこのケースをカバーする。

## 代替案

以下のアイデアは現時点では有用性が低い、実現可能性が低いなどの理由で採用される見込みの低いものである。

### 明示的なクリティカル CSS 定義

インライン化されるべきクリティカル CSS を開発者がアノテーションし、[postcss-critical-split](https://github.com/mrnocreativity/postcss-critical-split#readme)のようなツールで抽出するアプローチ。 このアプローチはその CSS がクリティカルであるかを開発者が判断しなければならないという問題と、サードパーティ CSS にはアノテーションできないという欠点があるため却下された。

```css
/* critical:start */
header {
  background-color: #1d1d1d;
  font-size: 2em;
}

.aside {
  text-decoration: underline;
}
/* critical:end */
```

### ヘッドレスブラウザによるクリティカル CSS 抽出

[Penthouse](https://github.com/pocketjoso/penthouse) はヘッドレス Chrome を使ってレンダリングしてクリティカル CSS を抽出するため、 Node.js で実行できない CSR のアプリケーションにも適用できる点で優れている。

ただしこのアプローチはランタイムで実行しなければならない Angular Universal のユースケースでパフォーマンスを落とすため却下された。

### ルートコンポーネントでのグローバル CSS 読み込み

いわゆる `AppComponent` の `styles` を使ってグローバル CSS を読み込んでしまうことで コンポーネント CSS として Render-Blocking しない形でインライン化するアプローチ。

これは App-Shell や Pre-rendering のユースケースにおいて `index.html` が `styles.css` の内容をすべて含み肥大化してしまう欠点がある。

### DNS-Prefetch と Preconnect Hints

Google Fonts と Icons の読み込みについて、DNS-Prefetch と Preconnect Hints を活用するアプローチ。 欠点は特に無いが CSS のインライン化のほうがより効果的であると考えている。

## RFC のフィードバック

RFC を通して集まったフィードバックのまとめは以下の通り。

- この機能はデフォルトで有効であり、オプトアウト可能であるべき
- 新しい Size Budget は新プロジェクト、既存プロジェクトの両方に追加されるべき
- CSS ファイルの Budget の追加にあたり、非利用 CSS の除去の手段も一緒に提供されることが望まれている

## まとめ

リリース時期はまだ未定であるが、Angular アプリケーションのパフォーマンス改善のための大きなプロジェクトである。 v10 で導入された CommonJS インポート時の警告といい、Angular 特有のパフォーマンスというよりは web.dev で取り上げられるようなベストプラクティス的なパフォーマンス改善のアプローチを、Angular CLI のデフォルト機能としてサポートする取り組みに力が入っているようにも見える。

- [How CommonJS is making your bundles larger](https://web.dev/commonjs-larger-bundles/)

Eliminate Render-Blocking Requests についてはゼロコンフィグ、あるいはほぼ設定不要で使えるべきであるという姿勢が強く見られるため、 完成には時間がかかりそうではあるがぜひ期待したい。


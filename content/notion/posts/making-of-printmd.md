---
title: 'Markdownファイルをいい感じに印刷する printmd を作った'
slug: 'making-of-printmd'
icon: ''
created_time: '2026-08-23T00:46:00.000Z'
last_edited_time: '2026-08-23T01:04:00.000Z'
tags:
  - 'Markdown'
  - 'CSS'
  - 'HTML'
  - 'Web'
published: true
locale: 'ja'
channels:
  - 'Code'
notion_url: 'https://app.notion.com/p/Markdown-printmd-3c43521b014a80268cdeec9c93bc9e0c'
features:
  katex: false
  mermaid: false
  tweet: false
---

表題のとおり、Markdownファイルをいい感じに印刷したいときに使えるツールとして**printmd**というものを作った。

[https://printmd.lacolaco.app](https://printmd.lacolaco.app/)

![image](/images/making-of-printmd/image.a504882203a8a4f4.png)

ソースコードはGitHubで公開している。実装にはAngularを使っており、サーバーサイドは存在せずブラウザだけで動作する。

## 印刷プレビューの実装

概要はGitHubのREADMEにも書いているが、印刷されるときのレンダリング挙動をプレビューするのは少しむずかしい。課題はページの概念と改ページの制御だ。

ページとはつまり、UIの固定サイズの領域に収まるサイズで分割してレンダリングするということだが、印刷用の分割を直接再現することはできない。しかし、おそらく同じメカニズムでレンダリングされているのがマルチカラムの**段組み**である。

https://developer.mozilla.org/ja/docs/Web/CSS/Guides/Multicol_layout/Basic_concepts

![image](/images/making-of-printmd/CleanShot_2026-08-23_at_09.14.242x.a771e00da8b5d5e9.png)

段組みレイアウトを使うと、カラムの大きさからあふれるコンテンツが次のカラムに送られる。この段組みの仕組みを利用すると、ブラウザが内蔵している改ページのルールをそのまま印刷プレビューとして表現できる。

段組みレイアウトの各カラムは横に並ぶため、ページとして縦に積むためにシート状のコンテナの中でクリッピングをおこなう。各シート (白い A4) の版面位置に `overflow: hidden` の窓を開け、その中に「**そのシートに対応するカラム**」を描画させるために、`margin-left: -(段位置 × 194mm)` だけ左へずらす。そうすると、窓から見えるのはちょうど 1 カラム = 1 ページ分になる。各シートの左右には前後のカラムが隠れているわけである。映像フィルムを投影しているようなイメージだ。

![image](/images/making-of-printmd/CleanShot_2026-08-23_at_09.19.392x.288743a74d6be57e.png)

## 強制改ページ

この**printmd**を必要とした最大の理由は、印刷時の改ページ制御である。任意の位置でページ区切りを調整したい。それも、改行の数で調整する脆弱な形ではなく、改ページそのものを命令したかった。

実は段組みレイアウトのために、`break-before: column` というプロパティはCSSに標準化されている。このCSSプロパティは対象の要素がカラムの先頭になるように区切ってくれるものなのだが、悲しいことに僕が常用しているFirefoxでは実装されていない。

![image](/images/making-of-printmd/CleanShot_2026-08-23_at_09.25.272x.dc4ba79b00c5aa18.png)

そのため、**printmd**の強制改ページは、代わりに文書を改ページ位置で「セグメント」（連続するトップレベルブロックの範囲）に分割し、セグメントごとに独立した段組みレイアウト（ストリップ）を作っている。横並びで続いているようにみえるが、独立した複数の段組みが連結しているということだ。各段組みは必ず自分の段 0 の先頭から始まるので、「セグメント先頭 = ページ先頭」が成立する。

![image](/images/making-of-printmd/CleanShot_2026-08-23_at_09.28.562x.2449b7149f0445b6.png)

こうすることで、異なる段組みがひとつのカラムに混ざることはないので、改ページを制御できるようになった。もちろんFirefoxで `break-before: column` さえ使えればもっとシンプルな実装にできるのだが。

実際に印刷するときには、CSSの `break-before: page` がどのモダンブラウザでも使えるため、セグメントの先頭になる要素にこのルールを与えておけば改ページができる。こうして印刷画面に入らずHTMLとCSSによってコンテンツの印刷プレビューができあがった。

```css
@media print {
  .forced-break {
    break-before: page;
  }
}
```

ブラウザ上だけでページを印刷するときのレイアウトをエミュレートすることで、印刷プレビューのためにPDFファイルを作るオーバーヘッドを抱えずに済んだ。細かいところでまだ完全ではないと思うが、とりあえず自分の用途としては困らない程度にはなっている。もし同じようなニーズがあれば使ってみてほしい。いちおうGitHubでイシューは受け付けている。


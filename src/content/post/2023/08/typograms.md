---
title: 'google/typograms を触ってみた'
slug: 'typograms'
icon: ''
created_time: '2023-08-10T12:11:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
category: 'Tech'
tags:
  - '日記'
  - 'Angular'
  - 'SVG'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/google-typograms-012e0360174849d6bdbf141976e33385'
features:
  katex: false
  mermaid: false
  tweet: false
---

Googleからtypogramsというおもしろそうなライブラリが公開されていたので触ってみた。

https://github.com/google/typograms

https://google.github.io/typograms/

アスキーアートをSVGに変換して描画するというものらしい。似たようなプロジェクトはいろいろあるが、typogramsは軽量であるということと、WSYWIGであるということが売りらしい。テキストで描いたものがリッチにSVG化されるという意味ではたしかにこれもWSYWIGと言えるのかもしれない。

> Unlike libraries like [mermaid](https://github.com/mermaid-js/mermaid), typograms are defined typographically (WYSWYG), rather than semantically (a transformation from a high level description to graphics), which picks a different trade-off: it gives you more control over the rendering (expressivity) at the cost of making you type more (productivity).

## 触ってみた

typogramsはまだNPMには公開されておらず、GitHubにソースコードがあるのみだが、それでもnpmのGitレポジトリ参照でインストールできる。型定義ファイルも書いてあげればTypeScriptで呼び出せるということで、このIssueコメントを参考に触ってみた。

https://github.com/google/typograms/issues/3#issuecomment-1670746657

さくっとAngularコンポーネントに組み込んで、Inputで受け取った文字列からSVGを生成できた。HTMLと違い、JavaScriptのテンプレートリテラル中で普通にバックスラッシュを書くとエスケープだということになるので、 `String.raw` タグ関数を使って描いてみた。

```ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, TypogramComponent],
  template: ` <app-typogram style="width: 300px" [source]="typogram"></app-typogram> `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  typogram = String.raw`
    _   
   / \  
  / △ \ 
 / ___ \ 
/_/   \_\ngular
  `;
}
```

![image](/images/typograms/Untitled.png)

実用性はまだわからないが、とりあえずおもしろかった。組み込んだ部分の詳細などはレポジトリを参照してほしい。

https://github.com/lacolaco/angular-typograms

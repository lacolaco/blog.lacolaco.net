---
title: 'k1LoW/deck: MarkdownでGoogleスライドを作る'
slug: 'deck-markdown-to-google-slides'
icon: ''
created_time: '2025-05-26T14:07:00.000Z'
last_edited_time: '2025-05-28T06:50:00.000Z'
category: 'Tech'
tags:
  - '雑記'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/k1LoW-deck-Markdown-Google-1ff3521b014a80ceac20c9e6e608bc43'
features:
  katex: false
  mermaid: false
  tweet: false
---

先日[TSKaigi 2025で登壇したときに使った資料](https://blog.lacolaco.net/posts/tskaigi-2025-slide/)は、Googleスライドで作ったものだが、実はその「ソースコード」はMarkdownで書いた。どういうことかというと、MarkdownファイルからGoogleスライドを生成できる “**deck**” というツールを使った。開発者はk1LoWさん。deckが生まれるに至るまでの経緯はぜひご本人のブログを読んでほしい。

https://github.com/k1LoW/deck

https://k1low.hatenablog.com/entry/2025/03/31/083000

deck はもともとk1LoWさんが個人的に使うために作ったツールのようだが、OSSとして公開されていたので試しに使わせてもらった。使ってみるとかなり手に馴染んで、実はTSKaigiの前にも「[技術書とお金 夏の夜](https://tech-book-cat.connpass.com/event/325189/)」での発表スライド（非公開）もdeckで作っている。

TSKaigi用のスライドのソースコードをGistに貼った。コメントを多用するので、プレビューでは消えてしまう。Rawで見たほうがよくわかると思う。

https://gist.github.com/lacolaco/f11270f4fb663841976e873b55020978

## なぜGoogleスライドか

Markdownを書いて、それを発表スライド化するツールは他にもいろいろあるが、僕は最終的な発表ツールはGoogleスライドを使いたかった。理由はざっと挙げると以下:

- **当日の失敗確率が低い**
  - BYODなイベントだったとしても、Googleスライドなら当日自分のPCがダメになっても最悪誰かにURL渡して助けてもらえる
  - スピーカー用パネルが便利（スピーカーノート、次ページプレビュー、タイマーなど）
  - Google Driveはなかなか壊れない
- 画像や図表を埋め込める
  - クリップボードから貼り付けられるのが助かる
- Google Developer Experts用のスライドテンプレートがあるので使いたい
- 終わった後URLで公開しやすい
- **慣れてる**

細かいところは他にも色々あるし、Googleスライドじゃなくてもできることも含まれているが、結局「慣れてる」が一番大きい。あまり失敗したくない発表の本番では手に馴染んで信頼できるツールを使いたい。

しかし我らプログラマー、プレーンテキストでいい部分にはプレーンテキストを使いたいという欲求が本能に刻まれているわけなので、MarkdownをソースコードとしてGoogleスライドが出力されるツールがあるなら飛びつくのも自然であった。

## deckの使い心地

結論からいうととてもよかった。使い始めはいろいろ困った部分もあったが、毎回GitHubにイシューを立てたらk1LoWさんが爆速で解決していってくれるので、どんどん自分好みのツールに育っていった。

- 絵文字のサポート

https://github.com/k1LoW/deck/issues/82

- リスト内でのインラインコードブロックのサポート

https://github.com/k1LoW/deck/issues/87

また、deckは最初は`apply`コマンドでバッチ処理するだけだったので、書きながらプレビューすることができなかった。その問題を解決するために、自前で[mise](https://mise.jdx.dev/) CLIを使って擬似的にdeckのwatchモードを作った。

https://scrapbox.io/lacolaco/k1LoW%2Fdeck_%E3%81%A7%E3%82%B9%E3%83%A9%E3%82%A4%E3%83%89%E8%B3%87%E6%96%99%E3%82%92%E4%BD%9C%E3%82%8B

https://scrapbox.io/lacolaco/k1LoW%2Fdeck_%E3%82%92monorepo%E7%9A%84%E3%81%AB%E4%BD%BF%E3%81%86%E3%81%9F%E3%82%81%E3%81%AE%E8%A3%9C%E5%8A%A9CLI

という話をk1LoWさんに伝えたら、本家にwatchモードが実装された。これがかなりゲームチェンジャーで、今後しばらくはdeckでスライドを作ろうと思えた進化だった。Markdown書きながらリアルタイムプレビューがあるというのはすばらしい。

https://k1low.hatenablog.com/entry/2025/04/30/083000

これが可能なのも、deckのコンセプトがよく効いていて、最初から継続的なスライドのメンテナンスができるようにテキストとリッチコンテンツ・デザインを分離した設計になっているからだ。

watchモードが生まれたことで、スライドがどうなるかをMarkdownを書きながら脳内レンダリングする必要なくなったのは革命的だった。

## 使う上での工夫

ここからは実際にTSKaigi 2025のスライドを作るうえでやった工夫、あるいはその裏にあるdeckの伸びしろについてのメモ。改めて要求を整理してまたイシューを投げるつもり。

### ソースコードを見せるスライド

ソースコードはシンタックスハイライトされた状態で見せたいので、テキストではなくCarbonのようなツールで画像化したものを貼りたい。

https://carbon.now.sh/

k1LoWさんはこれがターミナルでできる[silicon](https://github.com/Aloxaf/silicon)を使っているようだが、画像を作るにあたってはやはり視覚的にプレビューしてサイズの調整などもやりたいし、Carbonをこのまま使いたい。

deckにおいては画像だけを貼るページは白紙と同じだが、あとからMarkdownを見たときに何のページなのかわからなくなるので、コメントでCarbonに埋め込んでいるのと同じコードを書いて置いている。というより、まずMarkdown側で書いたソースコードをCarbonに貼り付けている。

````markdown
---

<!-- { "layout": "Blank - Black" } -->


<!--
```
let counter = 0;
const content = () => `counter: ${counter}`;
const render = () => {
  element.innerText = content();
}

const setCounter = (value: number) => {
  counter = value;
  render();
};

setInterval(() => setCounter(counter + 1), 1000);
```

 - counter が 状態 
 - 問題点
    - setCounterがrenderを直接呼び出す（状態管理とUIレンダリングの密結合）
    - counterの値に変化がなくてもcontentは再計算される
    - counterが更新されたときに別のUIも更新したくなったら？
-->

---
````

本当は、このように書いたソースコードがdeckのビルド時にsilicon的な何かを経由し自動的に画像化されてGoogleスライドに埋め込められるとイノベーションすぎるのだが、流石に求めすぎだと思うのでここは諦めている。

### ページの挿入・削除に弱い

おそらくこれはdeckの根本的な仕組み上仕方ないと思うが、Markdown側で10枚ページがあるときに、5ページ目と6ページの間に新たにページを作ると、それ以降の6から10ページまでがすべて再作成される。どういうことかというと、そのページにGoogleスライド側で貼り付けていた画像はすべて消える。同様に、途中のページを1枚消すとそれ以降のページが再作成される。

この問題があって画像が頻繁に貼り直しになるので、スライド中で使う画像はすべてローカルに保存しておいた。クリップボード貼り付けだと毎回Carbonで作り直すところからやり直しになる。

これはReactでいうところの `key` 、Angularでいうところの `track` と同じで、リストの長さが変わったときにそれがどの要素の追加・削除なのかを決定するためには各要素を追跡する識別子が必要で、それがMarkdown内にないからページインデックス以外に頼るものがないのだ。

Markdown側でページを増やす・減らす前にGoogleスライド側であらかじめ整合性が取れるように変えておくとうまくいくケースもありそうだが、なかなか難しい。なので、Googleスライド側の作業が始まる前にページ数だけは確定させておかないと手戻りが多くなる。

しかし実際にスライド作るときにはページを削ったり、順番を入れ替えたりという編集作業は終盤にこそ多いので、ここがいま一番deckでどうにかなってほしい部分だ。

Markdown側で `key` を明示的に書けばそれを追跡して移動を検出する？`apply` のときにMarkdown側に機械的に採番された`key`を埋め込む？Howはイシューを挙げてからの話になるが、ユーザビリティとの両立がけっこう難しい問題だと思うが、k1LoWさんならきっとやってくれそう。

## お試しあれ

普通に便利なうえに、開発者との距離が近くOSSとしても面白いので、ぜひ普段Googleスライドを使っているがMarkdownでソースコード管理したいと思った方は使ってみてほしい。広げようdeckの輪。

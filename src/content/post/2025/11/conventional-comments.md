---
title: 'Conventional Comments'
slug: 'conventional-comments'
icon: ''
created_time: '2025-11-30T13:28:00.000Z'
last_edited_time: '2025-12-02T07:54:00.000Z'
tags:
  - 'コードレビュー'
published: false
locale: 'ja'
category: 'Idea'
notion_url: 'https://www.notion.so/Conventional-Comments-2bb3521b014a80b88b48d68bef7324ce'
features:
  katex: false
  mermaid: false
  tweet: false
---

『Looks Good To Me』を読んだ時に知った “**Conventional Comments**” というものがある。このフォーマットについて一度書いておきたい。

https://blog.lacolaco.net/posts/book-review-looks-good-to-me

Conventional Commentsはコードレビューをするときに書くコメントのフォーマットについての提案である。

https://conventionalcomments.org/

名前からわかるように、Gitのコミットメッセージのフォーマットとして有名な **Conventional Commits** にインスパイアされている。

https://www.conventionalcommits.org/ja/v1.0.0/

Conventional Comments ではコードレビューコメントに次のような基本構文を与える。

```
<label> [decorations]: <subject>

[discussion]
```

![image](/images/conventional-comments/CleanShot_2025-11-30_at_22.34.092x.53e1d4bd28f2af0d.png)

Conventional Commitsと同様に、チームやプロジェクトの中で合意されたwell-knownなラベルのリストの中から選択することで、そのコメントの意図を明確にできる。Conventional Commentsは考え方としてはおもしろく、フォーマットは無駄がないものだと思いつつ、これがうまくいくかどうかはチームのラベル設計・定義のセンスに依存する度合いが強いように感じている。

`nitpick` についてはそもそもnitpickなコメント自体ノイズなのでやめておきたい。なのでラベルも不要だろう。そんなラベルをつけるくらいならコメントしなければいいのだ。

`suggestion` も意図が読みづらい。その提案の温度感というか、却下していいのかどうかがコンテキストフルになりがちだ。デコレーションのほうで blocking や non-blocking と補足しなければならないのでこれもいまいち。`issue`もそうだ。問題だと指摘するのはいいが、そのプルリクエスト中で直してほしいのかイシューチケット化しておけばいいのか、結局「どうしてほしいのか」がわかりにくい。

LGTM本の著者エイドリアン氏のチームでは `needs change` / `needs rework` / `align` / `levelup` / `nitpick`  という5つのコメントシグナルを使っていたらしい。どれがblockingな指摘なのかは定義を覚える必要があるため、個人的には `needs xxx`  のフォーマットで揃えたほうがいいのではと思う。いちばん重要なのは**そのコメントがプルリクエストをブロックしているのかどうか**の識別性だ。

たとえば、ラベルに`!`をつけることでblockingであることを示すとどうだろう。`suggestion!`や`refactor!`のように使うことで、その指摘が解消されるまで承認できないことを示す。逆に`!`がついていないものは承認を止めないものとして扱うという合意があれば、コードレビューを受け取る側もコメント対応の優先順位がつけやすいのではなかろうか。`nitpick!`なんてありえないわけなので考えることは減る。

Conventional Commitsのほうでも`!`は破壊的変更を含むことを示すシグナルになっている。その対応からしても、PRに対して変更を要求することはイメージしやすいだろう。このような工夫ひとつで、コードレビューを受けたあとの「このコメントへの対応は必須だろうか？」と悩む時間がなくなると思えば安いものだ。

ところで、AIエージェントによるコードレビューをさせる際に、Conventional Commentsに準拠するよう指示してみたが、それなりによく機能した。しかし教育目的でもない限り、AIから`praise`をもらったところで何も嬉しくないし、`nitpick`はトークン消費のムダなので、そういうラベルは禁止して`suggestion`や`issue`だけを出すように強く規定したほうがよさそうである。


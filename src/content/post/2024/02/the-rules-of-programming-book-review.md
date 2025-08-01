---
title: '『ルールズ・オブ・プログラミング』読後メモ'
slug: 'the-rules-of-programming-book-review'
icon: ''
created_time: '2024-02-18T00:21:00.000Z'
last_edited_time: '2024-02-18T00:57:00.000Z'
category: 'Diary'
tags:
  - '読書'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/ca3bf239647a4d90ad2ae9c42c8e46b3'
features:
  katex: false
  mermaid: false
  tweet: false
---

オライリー・ジャパン『ルールズ・オブ・プログラミング』を読んだのでメモ。

https://www.oreilly.co.jp//books/9784814400416/

## 感想

funの意味でもinterestingの意味でもおもしろい本だった。

まずは経験豊富なすぐれたプログラマーの実体験に基づくプラクティス集として読める。紹介されている21のルールは非常によく考えられていて、よりよいプログラミングをおこなうためのハウツー本のように読むこともできる。だがまえがきに書かれているように、そういう風に本書の内容を無条件に肯定的に読むことは推奨されていない。

また、あるゲーム開発者の伝記のようにも読める。歴史のあるゲーム開発会社のなかでどういう経緯でどのような判断がなされてきたのかをなんとなく感じられる。サンプルコードの内容や題材もゲームに関連したもので、イメージしやすい。

そして、提示されたルールに対して批判的に向き合うことで自分なりのルールについて考えるきっかけをくれる啓発本でもある。あくまで筆者の会社、チームで機能しているルールであり、それがなぜ機能するのかという前提条件についても詳しく書かれている。だから翻って読者自身のチームにとってどんなルールが必要なのかを考えるための材料が揃っている。そういう刺激をくれる本だった。

これらが口語的な文章でとても読みやすい。日本語訳のうまさに何度か感動した。『ルールズ・オブ・プログラミング』という普遍性の強いタイトルに負けず、この本は確かにこの時代に広く読まれるべきだと思った。しばらく布教していきたい。

## ハイライト

### 最終的に、プロジェクトを殺すのは、複雑性だろう

> プログラミングの中心にあるのは、複雑性との戦いだ。… 先に進もうとするどんな試みも、問題を解くそばから、解いた問題の数だけ同じ数の問題を新たに発生させる。その先への進捗は、事実上不可能だ。
> 最終的に、プロジェクトを殺すのは、複雑性だろう。
> それはつまり、不可避な結末を遅らせることこそが、効果的なプログラミングの本質であるということだ。 (p.18)

### コードレビューの真価

> 誰かが見ることになると分かっていれば、より良いコードを誰しも書くようになる。 (p.109)

### 共通知識は無料だが、新しい概念は高くつく

> コードを書くなら、チーム内で共有された、標準的な抽象化やパターンを使うことだ。新しいものを発明しちゃいけない……新たに発明した抽象化やパターンが、チーム全体での標準になるくらい強力だという自信がない限りは。 (p.166)

### とにかく釘を打たなきゃいけないこともある

> でも、あらゆる問題にエレガントな解法があるわけじゃない。どんなにわくわくするプログラミングの課題であれ、退屈な作業が占める瞬間はあるものだ。例えば、面白くないタスク、わくわくしづらいタスク、誰もやりたがらないタスクとか。退屈な作業は後回しにして、チームの誰かが代わりに引き受けてくれるよう密かに願いつつ、わくわくするものの方に取り組んでしまいやすい。
> こんな風に前提を置いていると、本章の教訓に意表を突かれはしないだろう。「**退屈な作業をスキップしちゃいけない**」って教調だ。その愛嬌のないタスクはどこにも行きゃしない。きみが寝てる間に仕事をこなしてくれる、コードの妖精さんの大群はどこにも隠れていない。そして、中途半端にしかできてないタスクは、プロジェクトを死に至らしめる遅効の毒なのだ。 (p.351)

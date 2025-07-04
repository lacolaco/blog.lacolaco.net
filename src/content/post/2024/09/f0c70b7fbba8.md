---
title: '『SREをはじめよう』（オライリー・ジャパン）を献本いただきました'
slug: 'f0c70b7fbba8'
icon: ''
created_time: '2024-09-28T05:34:00.000Z'
last_edited_time: '2025-06-11T08:40:00.000Z'
category: 'Diary'
tags:
  - '読書'
  - 'SRE'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/SRE-10f3521b014a80c99fa3fba715751ea4'
features:
  katex: false
  mermaid: false
  tweet: false
---

2024年10月4日に発売されるオライリー・ジャパンの『SREをはじめよう』を翻訳者の[ymotongpoo](https://x.com/ymotongpoo)さんから献本いただいたので、まだ全部読んだわけではないですがこの本のおすすめポイントを紹介します。

https://www.oreilly.co.jp/books/9784814400904/

https://amzn.asia/d/0T0ceiw

![image](/images/f0c70b7fbba8/image.png)

## 量的構成

まずは目次の情報を元に、この本の量的構成をまとめておきます。本書は3つの部と17の章からなり、いくつかの付録がついています。部ごとの構成は次のようになっています。

|                               |           |
| ----------------------------- | --------- |
| 第Ⅰ部 SRE入門                 | 56ページ  |
| 第Ⅱ部 個人がSREをはじめるには | 90ページ  |
| 第Ⅲ部 組織がSREをはじめるには | 102ページ |
| 付録                          | 34ページ  |

<figure>
  <img src="/images/f0c70b7fbba8/%E9%87%8F%E7%9A%84%E6%A7%8B%E6%88%90%EF%BC%88%E9%83%A8%EF%BC%89_%281%29.png" alt="量的構成（部ごとのページ比率）">
  <figcaption>量的構成（部ごとのページ比率）</figcaption>
</figure>

序文にも書かれていますが、この本の主題は2つの問い、「**私（個人）はどのようにSREをはじめればよいのか？**」と「**私の組織はどのようにSREをはじめればよいのか？**」です。それがそれぞれ第Ⅱ部と第Ⅲ部で30%以上書かれており、それらの前提となるSREの入門的な内容も約20%とそれなりの分量で占めているのがわかります。そして際立つのは付録の多さで、全体の12%が付録です。

章ごとに見ると、だいたいどの章も同じボリュームであることがわかります。少し長いのは10章「失敗から学習する」と13章「ビジネス観点からのSRE」ですが、それでも章ごとに読んでいけば均等なリズムで読み進められそうです。

<figure>
  <img src="/images/f0c70b7fbba8/%E9%87%8F%E7%9A%84%E6%A7%8B%E6%88%90%EF%BC%88%E7%AB%A0%EF%BC%89.png" alt="量的構成（章ごとのページ比率）">
  <figcaption>量的構成（章ごとのページ比率）</figcaption>
</figure>

## この本の問い

先にも書いたように、この本は2つの大きな問いに読者が取り組むために書かれています。それは「**私（個人）はどのようにSREをはじめればよいのか？**」と「**私の組織はどのようにSREをはじめればよいのか？**」です。これらはどちらか一方だけで完結するものではなく、個人の活動の集まりが組織の活動を作るし、組織のサポートによって個人の活動を支えることになります。著者によれば、第Ⅱ部と第Ⅲ部はどちらから読み始めてもかまいません。より自分が抱える課題に近そうな方から読み始めて、残った方はあとに回して読み進めることが推奨されています。どちらから読むにしろ、もう一方の部を読むことで先に読んだ部の理解も深まるはずです。

## 誰のための本か

この本はSREを「はじめる」ための本であり、したがって想定される読者は**SREをはじめたい人**、あるいは、**はじめなければならないと感じている人**でしょう。それは個人のキャリアプランとして考えている人かもしれないし、自分の会社のプロダクトが抱える課題から必要に迫られているマネージャーや経営者、はたまたSREという仕事があることを知って憧れる学生かもしれません。この本はそうしたすべての人におそらくなんらかの知恵を与えてくれますし、「はじめる」ための次のアクションを考える材料をくれるでしょう。

そのことが特に現れているおもしろい部分が、第Ⅱ部の7章「SREとして採用されるためのヒント」です。この章では、SREらしい求人情報の見分け方や面接に向けて備えるべき知識など、SREとして仕事を得たい求職者向けの実践的なノウハウが書かれています。これはいままでのSRE関連書籍にはあまりない、この本の特徴的な要素だと思います。SREを「はじめる」というのは、単にインフラや監視といった技術を学ぶことだけではなく、SREとしての「**キャリアをはじめる**」ことも含まれているということです。

また、組織がSREをはじめるためのアドバイスとしては、第Ⅲ部最初の11章「成功のための組織的要因」と12章「SREはいかにして失敗するか」という並びも目を引きます。組織がSREをはじめるにあたって成功と失敗を分ける要因を知ることで、そもそもSREをはじめるまえにやらないといけないことがないか、はじめようとしている動機は正しいのかといった視点を得ることができるでしょう。過去にSREをはじめようとして失敗したり、苦しんでいる組織では冒頭の次の一文だけでグサッと刺さるのではないでしょうか。

> 大雑把に一般化すると、この文脈での失敗は次の2つのうちのどちらかに当てはまります。(1)組織がある種の免疫反応を持っていて、時間が経つにつれSREの取り組みを完全に拒否する、あるいは、おそらくもっと悲劇的なことが起きる、(2)SREが提供する利益や価値に近いものを受け取れず、SREは静かな絶望の生活を送る、のいずれかです。
> (p161 12章「SREはいかにして失敗するか」)

## SREをはじめよう

SREとは何なのか？何を知っていて、どのような姿勢で活動し、どのような文化を持っているのか？どうしたら自分や自分の組織はその文化を手に入れられるのか？このような問いに少しでも思い当たるフシがあれば、おそらく得られるものがある一冊でしょう。今後SREを目指す人にとって、まず最初に読むべき本としておすすめされるだろうと思います。ぜひ手にとってみてください。

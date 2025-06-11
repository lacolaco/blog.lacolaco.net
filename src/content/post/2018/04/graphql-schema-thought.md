---
title: 'GraphQLのスキーマについて今日考えてたこと'
slug: 'graphql-schema-thought'
icon: ''
created_time: '2018-04-03T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'GraphQL'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/GraphQL-acc3701986524e0a812f1496941ec93a'
features:
  katex: false
  mermaid: false
  tweet: false
---

今日は GraphQL のクエリのスキーマを考えてた

いろんなデータが関連していて、原理的にはどんな入れ子の順番でも解決はできるんだけど、基本的にはデータの寿命が短い順に入れ子になっていくのが良さそうな気がする。

```
user { organizations {}  }
```

はユーザーの所属する組織はそんな頻繁に変わるものじゃないから、たいてい user のほうが organization より更新頻度が高い。

この場合 user をクエリしたときのレスポンスをキャッシュできるかどうかは user がボトルネックになる==ルートレベルなので、キャッシュ可能かどうかがわかりやすい気がする。なんというか、organizations は user のフィールドだってのはしっくりくる。

逆の関係の場合

```
organization { users {} }
```

は組織に紐付くユーザーは増えたり減ったりするから、たいてい users のほうが organization より更新頻度が高くなりそう。 このクエリは本質的には organization を要求しているはずなんだけど、キャッシュは organization が変わってなくても users が変わるたびに捨てなきゃいけないので、あんまり頭良くない気がする。users は organization のフィールドとはあんまり思えない感じ。

今は直感というか、嗅覚みたいなところでこれ考えてるんだけど、この辺の設計論を理論立てて書いてる本とかあったら誰か教えてください。

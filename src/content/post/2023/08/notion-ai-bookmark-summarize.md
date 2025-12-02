---
title: 'Notion AIでブックマークした記事を要約する'
slug: 'notion-ai-bookmark-summarize'
icon: ''
created_time: '2023-08-20T05:28:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
tags:
  - '雑記'
  - 'Notion'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Notion-AI-d857b4c4fa8b40868a782f2b4ab3fbf0'
features:
  katex: false
  mermaid: false
  tweet: false
---

https://blog.lacolaco.net/2023/08/inside-laco-feed/

この記事に関連して、Notionに保存したブックマークを要約する仕事をNotion AIにやらせてみたら、けっこういい感じに使えそうな気がした。

実物はこんな感じ。 `summary` プロパティの内容は、ページの作成時に自動入力される。

![image](/images/notion-ai-bookmark-summarize/Untitled.82c8de61b9359113.png)

[https://lacolaco.notion.site/bce0d0a9147e468ca227788ca1797d28?v=6d4b5ebf2fe349298b11c46c6397df1a&p=3c78c1ab946646d18e83541d33d52e6c&pm=s](https://lacolaco.notion.site/bce0d0a9147e468ca227788ca1797d28?v=6d4b5ebf2fe349298b11c46c6397df1a&p=3c78c1ab946646d18e83541d33d52e6c&pm=s)

NotionのWebクリップ機能はURLを保存するだけでなく、ページのHTMLもなんとなくコピーして本文に保存してくれる。なのでカスタムプロパティのAIブロックで本文を要約させれば、なんとなく機能する。

![image](/images/notion-ai-bookmark-summarize/Untitled.bce3ba7a2d20f4c6.png)

というわけで、とりあえずさわりだけ読んで気になったページを雑にブックマークに放り込んでおけば全部読まなくても要約されるし、要約を読んだ上でちゃんとソースを読みに行くかどうかを決められるようになった。21世紀っぽい。


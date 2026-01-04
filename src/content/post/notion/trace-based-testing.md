---
title: 'Trace-based Testingというアイデアに感動した'
slug: 'trace-based-testing'
icon: ''
created_time: '2023-08-09T11:35:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
tags:
  - '日記'
  - 'Testing'
published: true
locale: 'ja'
category: 'Diary'
notion_url: 'https://www.notion.so/Trace-based-Testing-01bcb5d2a0e14ced8760bbf17db18b2f'
features:
  katex: false
  mermaid: false
  tweet: false
---

先日、Trace-based Testingなるテスト技法についてのブログを読んで感動した。（感動しただけでまだ試してはいない。）

https://opentelemetry.io/blog/2023/testing-otel-demo/

何に感動したかというと、トレースによってシステムの振る舞いをテストするというアイデアは、僕がPHPカンファレンス福岡で発表したテストについての基本的な考え方とこの上なくマッチしていて、なおかつ具体的な技法としてトレースをテストに使うという発想は僕の中になかったからだ。あっぱれという感じだ。

https://blog.lacolaco.net/2023/06/presentation-phpconfuk-testing-dom/

PHPカンファレンス福岡では、テストの本質は開発者が安心を得るためのプロセスであり、したがって、「このテストが通るなら本番でも期待通りに動作するはずだ」と思えるようなテストが、テストとしてのパフォーマンスが高いと話した。

Trace-based Testingがもっともよく機能するのは、開発者がデプロイ後にシステムの正常動作を検証するために最も信頼しているものがトレースである場合だろう。つまり、**本番デプロイ後にデプロイの成功を確認するのと同じ方法で、デプロイ前のシステムを検証する**ということだ。まさしくこれは「このテストが通るなら本番でも期待通りに動作するはずだ」と思えるようなテストである。

裏を返せば、Trace-based Testingは、普段トレースを見ていないならばたいして安心に繋がらないだろう。テストのためのトレースになってしまっては意味がない。

日頃、何をもってデプロイが成功したと判断しているか。それが自分が何によって安心を得ているかということである。デプロイ後に手元で動作確認しなければ安心できないなら、Trace-based Testingはそれほど安心につながらないだろう。逆に、手元の動作ではなくリアルユーザーモニタリングによるトレースを強く信頼しているのなら、Trace-based Testingは試して見る価値があるように思う。


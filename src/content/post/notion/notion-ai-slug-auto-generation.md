---
title: 'Notion AIがslugを作ってくれるらしい'
slug: 'notion-ai-slug-auto-generation'
icon: ''
created_time: '2023-06-23T00:29:00.000Z'
last_edited_time: '2023-12-30T10:04:00.000Z'
tags:
  - '雑記'
  - 'Notion'
  - 'Blog Dev'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Notion-AI-slug-b32d2012806c4c348ecc004f9385e1c0'
features:
  katex: false
  mermaid: false
  tweet: false
---

このブログの記事はNotionをHeadless CMSとして使っているので、Notion AIを使うことができる。今回、この記事のslug（URLパスの日付以降の部分）はNotion AIに自動生成してもらった。

![image](/images/notion-ai-slug-auto-generation/Untitled.51707901edeed5c4.png)

https://www.notion.so/ja-jp/help/creating-and-editing-with-ai#autofill-databases-with-ai

プロパティの種別をNotion AIによるカスタム自動入力に設定し、プロンプトを記述する。

slugがあとで勝手に変わっては困るので、自動更新はオフにしている。

![image](/images/notion-ai-slug-auto-generation/Untitled.e5c8d11b0bdc0e05.png)

日本語プロンプトでも解釈してくれているのでよくできていると思う。記事を書いたあとslugを考えるのが面倒だったのでこれはけっこう便利そう。


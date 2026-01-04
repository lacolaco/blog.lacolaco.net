---
title: 'npmの新しいパッケージ名ルールについて'
slug: 'npm-new-package-name-rules'
icon: ''
created_time: '2018-01-04T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
tags:
  - 'npm'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/npm-281f136b6bbe4581b7daae8db0af3c61'
features:
  katex: false
  mermaid: false
  tweet: false
---

新年初記事は軽めにさくっと。

年末にひっそりと（？）ブログ記事が公開されていたけど、結構重要そうな npm レジストリのアップデートについて。

元記事はこちら

http://blog.npmjs.org/post/168978377570/new-package-moniker-rules

まとめると、

- `` `.` `_` を無視して結合した文字列でパッケージ名のユニーク性を検証します

`react-native` は `reactnative` というキーで扱われ、以下の名前のパッケージを publish することはできません

- `reactnative`
- `react_native`
- `react.native`

同様に、 `jsonstream` が存在する限り、以下の名前のパッケージも publish できません

- `json-stream`
- `json.stream`
- `json_stream`
- `js-on-stream`

また、この検証処理は validate-npm-package-name パッケージでローカルでも試せるとのこと

https://www.npmjs.com/package/validate-npm-package-name

新しいルールに抵触してしまうパッケージを公開したい場合は、Scoped Package を使いましょう（Scoped への移行を促したい npm チームの気持ちを感じる）


---
title: npmの新しいパッケージ名ルールについて
date: "2018-01-04T03:47:30.830Z"
tags: [npm]
---

新年初記事は軽めにさくっと。

年末にひっそりと（？）ブログ記事が公開されていたけど、結構重要そうな npm レジストリのアップデートについて。

元記事はこちら

http://blog.npmjs.org/post/168978377570/new-package-moniker-rules

まとめると、

- `-` `.` `_` を無視して結合した文字列でパッケージ名のユニーク性を検証します

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

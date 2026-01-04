---
title: 'CircleCIからGitHub Actionsへの移行 (Node.js)'
slug: 'migrate-circleci-to-github-actions'
icon: ''
created_time: '2019-09-16T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
tags:
  - 'GitHub Actions'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/CircleCI-GitHub-Actions-Node-js-b989169bf9a4470a9aae9eb49a823e4a'
features:
  katex: false
  mermaid: false
  tweet: false
---

自作のライブラリのCIをCircleCIからGitHub Actionsへ移行したメモ

https://github.com/lacolaco/reactive-store

https://github.com/lacolaco/reactive-store/pull/80

特にメリットがあるから乗り換えたとかいうわけでもないけど、GitHubだけで完結するならそれに越したことはない

## ファイルの場所

`.github/workflows/<ワークフローの名前>.yml` だが、いまのところ複数作るユースケースが見えないので `main.yml` とした。

## 実行環境

`ubuntu-latest` を選択した。特に理由はないけど一応MacOSやWindowsも選べるっぽい？

https://help.github.com/en/articles/software-in-virtual-environments-for-github-actions#ubuntu-1804-lts を見るとわかるが、 めちゃくちゃ充実したプリインのソフトウェアがある。 `yarn` や Git、Docker、Chromeもなんの設定もなく最初から使えるのはよい。

今回の移行ではもともと `circleci/node:carbon-browsers` を使っていたけど、 `ubuntu-latest` だけで事足りた。 Node.jsのバージョン指定は `node-version: [12.x]` のところでマトリックスにできるので、実行環境とは切り離して考えられる。

## 全体

```
name: Main

on: [push]

jobs:
  build:

    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [12.x]

    steps:
    - uses: actions/checkout@v1
    - name: Run tests with ${{ matrix.node-version }}
      uses: actions/setup-node@v1
      with:
        node-version: ${{ matrix.node-version }}
    - name: npm install, build, and test
      run: |
        yarn install
        yarn build
        yarn lint
        yarn test:ci
      env:
        CI: true
```

もともと大したことをやってないので、あっというまに置き換えが終わった。

## ポイント

- `yarn` は最初から入ってるから気にしなくていい (現在は1.17.3っぽいが多分latest追従だろうか)
- Chromeも最初から入ってるから気にしなくていい (Headlessはまだ試してない）
- Node.jsのバージョン指定は `actions/setup-node` の引数で変えられる


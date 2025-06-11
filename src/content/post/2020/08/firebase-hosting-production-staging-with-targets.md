---
title: 'Firebase HostingのDeploy Targetsを使ってproduction/staging環境を分ける'
slug: 'firebase-hosting-production-staging-with-targets'
icon: ''
created_time: '2020-08-17T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Firebase'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Firebase-Hosting-Deploy-Targets-production-staging-f6287c7268f94adcbe2470f401207886'
features:
  katex: false
  mermaid: false
  tweet: false
---

これまで Firebase Hosting を使ったプロジェクトで production/staging の環境を分けたいときには Firebase プロジェクトごと分離していた。プロジェクトごとクローンしてしまえばいいので考えることはシンプルではあるけども、管理する Firebase プロジェクトが増えるのはうれしくないし、課金設定の把握も数が増えると一苦労になる。

Firestore のインスタンスを分けなくていいという条件付きなら Firebase プロジェクトで分けなくても Firebase Hosting の Multiple Sites 機能を使えばいいんじゃないかと思い至り、やってみたら案外簡単だったのでメモ。

## 動いているもの

趣味で作っている Web アプリ

[pokepartymatch | ポケモン構築支援ツール](https://pokepartymatch.web.app/)

これの staging 環境を作った。

[https://pokepartymatch-dev.web.app/](https://pokepartymatch-dev.web.app/)

リポジトリはこちら

[https://github.com/lacolaco/pokepartymatch](https://github.com/lacolaco/pokepartymatch)

GitHub Actions を使い、master ブランチへの push で staging 環境で自動デプロイし、 バージョンタグを打った commit を push したときに production 環境へ自動デプロイするようにした。

- [https://github.com/lacolaco/pokepartymatch/blob/master/.github/workflows/deployment-staging.yml](https://github.com/lacolaco/pokepartymatch/blob/master/.github/workflows/deployment-staging.yml)
- [https://github.com/lacolaco/pokepartymatch/blob/master/.github/workflows/deployment-production.yml](https://github.com/lacolaco/pokepartymatch/blob/master/.github/workflows/deployment-production.yml)

## 手順

前提として、まず単一の Firebase Hosting でデプロイできる状態になっていることとする。

### 1. Firebase コンソールで staging 用の Site を追加する。

Web コンソール上でポチっと押せばすぐできる。リンクの場所ははじめて Site 追加するときば場所が違うと思うが、探せば見つかる。

サブドメインの入力を求められるがこれがそのまま Site の ID？のような識別子になる。今回はたまたま `-dev` が空いていたので使ったが何でも良い。

![image](/images/firebase-hosting-production-staging-with-targets/Untitled.png)

### 2. プロジェクトの `.firebaserc` にターゲットを追加する

Firebase プロジェクト上に作った Site を、Firebase CLI が備える **Deploy Targets** という設定と紐付ける。

[Deploy targets | Firebase](https://firebase.google.com/docs/cli/targets?hl=en)

直接編集してもよいが、CLI でやれば実際にその ID の Site が存在するかをサーバーに問い合わせてくれるので Typo に気づけて安心。 `TARGET_NAME` は任意の名前で、 `RESOURCE_NAME` はさきほど作成した Site のサブドメイン部分。

```shell
> firebase target:apply hosting staging pokepartymatch-dev
```

完成形はこちら。production の設定も追加している。

[https://github.com/lacolaco/pokepartymatch/blob/master/.firebaserc](https://github.com/lacolaco/pokepartymatch/blob/master/.firebaserc)

### 3. `firebase.json` で Hosting の Site と Deploy Targets を紐付ける

`firebase.json` ファイルの `hosting` 設定で、各ターゲットごとの Hosting の設定をする。設定を分ける必要がなかったとしても `target` フィールドで探されるのでそれぞれ対応する設定が存在しないとエラーになる。

[https://github.com/lacolaco/pokepartymatch/blob/master/firebase.json#L2](https://github.com/lacolaco/pokepartymatch/blob/master/firebase.json#L2)

### 4. デプロイ時にターゲットを指定する

あとは `firebase deploy` コマンドを実行するときに production か staging かを指定するだけ。production 時のみ Firestore などほかのコンポーネントも同時デプロイするようにしている。

```
"deploy:staging": "firebase deploy --only hosting:staging",
"deploy:production": "firebase deploy --only hosting:production,firestore",
```

## 振り返り

- ある程度割り切れば Multiple Sites での production/staging は運用が楽そう
- Storage は Bucket を分ければいいし、Functions や Firestore は完全には分離できないが URL 設計や Collection 設計次第でどうにかできそう。特に Firestore は情報がセンシティブならやめたほうがいいけどルートレベルで production/staging の分岐することはできそう
- そもそも真に Staging なのであれば production と同じデータを使用しているべきではという話もある。（Functions で production→staging の自動コピーしてあげてもよさそうだが）

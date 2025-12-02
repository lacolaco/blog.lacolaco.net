---
title: 'ng-conf 2017 1日目 Keynoteメモ'
slug: 'ng-conf-2017-day-1-note'
icon: ''
created_time: '2017-04-05T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/ng-conf-2017-1-Keynote-b0f5f2b306014805b6f332feed870c3c'
features:
  katex: false
  mermaid: false
  tweet: false
---

アメリカ・ソルトレイクシティで4/5から開催中のng-confに参加しています。 1日目のKeynoteの内容を現地からかいつまんでまとめます。

## Keynote

- スピーカー
  - Igor Minar
  - Stephen Fluin

### ドキュメンテーションのアクセス数

- 2017年4月現在 AngularJS 1.3M vs Angular 810K
- まだまだAngularJSが優勢だけど、どんどんAngularの採用事例は増えている

### Code of Conduct

- Angularの管理するリポジトリやそれに付随するコミュニティにおける行動規範を https://github.com/angular/code-of-conduct にまとめた
- 何か問題が起きたら conduct@angular.io に連絡してほしい

### エコシステム

- エコシステムにもっとも重要なのは一貫性
- AngularJSとAngularの名前を徹底して使い分けていくことで、名前を見ただけで何を指しているかわかるのでコミュニケーションが楽になる

### Language Services

- VS Code, WebStorm, Angular IDE(Eclipse plugin)の3つで使えるようになった

### Ionic

- npmで100万installされている
- キラーアプリ: UNTAPPED
- 本日3.0リリース: Angular 4.0対応、起動時間の短縮、デスクトップ・タブレット環境のサポート

### Angular Today

- 多くのアプリケーションがプロダクションとしてリリースされている
- Angularアプリケーションのうち17%はすでにv4
- Google社内の200以上のアプリケーションはすべてv4にアップデート済み

### 採用事例: [NBA.com](http://www.nba.com/)

- DrupalやD3、Reduxなどと併用してプロダクションに採用している

### v4について

- ユーザーへの利点
  - より小さく、より速く
  - 4.0をinstallしてビルドするだけでUXが改善する
- 開発者への利点
  - ngIf, ngForなどの新APIによるReactive Angularの改善
  - Angular CLIの1.0リリース
- stableなAPIの一般的なユースケースについては破壊的変更なし
- スムーズなアップデートを可能にした

### 進行中の計画

- Angular Universal
  - 基本的なAPIはplatform-serverとしてv4でリリースできた
  - 高レイヤーのライブラリやドキュメンテーションをこれから増やしていく
- Progressive Web Apps
  - Angular CLIでserviceWorker: trueのサポート
  - これからもPWA支援を続ける

### GoogleにおけるAngular

- Googleでは常にリリース前の最新のビルドを使っている
- npmにリリースされる最新のビルドは常にGoogleのチェックを通過している

### 最新版を使って欲しい

- Googleのチェックを通過している
- 新機能や最新の修正が入っている
- 多くのツールやライブラリとの統合
- **Angular v4は長期サポート(LTS)バージョンになった**
  - 2018年10月まで、重大なバグフィックスやセキュリティパッチが続けられる
  - もし会社の都合でなかなか最新版に上げられないときはこれで説得してほしい

### v5のテーマ

- 単純さ
  - クライアントサイド、サーバーサイド、JIT、AOTなど、複雑さが増している
  - v5では開発者が気にしなければならないものを減らしていく
- スピードとサイズ
  - Tree-Shakingの効果が高まるようなコード生成に改善していく
- スムーズなアップデート
  - v2からv4と同じようにアップデートできるようにする

---

オープンソースで開発されているのでほとんどの内容はすでに知られていることでしたが、LTSの発表には驚きました。 今回は採用事例についての話が多く、Angularをプロダクションにどんどん使ってもらいたいことは強く伝わってきました。

Keynoteは3日目にもあるので、そちらもメモを投稿する予定です。近いうちにKeynoteの動画はyoutubeに上がると思うので、詳しく知りたい方はご自身で確認してください。


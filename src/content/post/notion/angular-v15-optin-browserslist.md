---
title: 'Angular: browserslist設定ファイルの削除とオプトイン (v15)'
slug: 'angular-v15-optin-browserslist'
icon: ''
created_time: '2022-09-15T00:09:00.000Z'
last_edited_time: '2022-09-15T00:00:00.000Z'
tags:
  - 'Angular'
  - 'browserslist'
  - 'commit note'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-browserslist-v15-5d1a14f0328a4165a2e580e75aefe9ec'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular CLI は `ng new` や `ng generate application` で生成されるアプリケーションテンプレートから `.browserslistrc` ファイルを削除する。

https://github.com/angular/angular-cli/commit/9beb878e2eecd32e499c8af557f22f46548248fc

Angular CLIはフレームワークがデフォルトでサポートするブラウザセットを内部で管理しており、同じ設定をすべてのアプリケーションで二重に管理する必要はないとされたためだ。

`ng update` では、プロジェクトの `.browserslistrc` ファイルの内容がデフォルトのままであれば削除され、変更が加えられていればそのまま残される。

Browserslistによるサポート対象ブラウザの拡張がなくなったわけではなく、アプリケーションのテンプレートから削除され、開発者がオプトインで導入するものになったということだ。


---
title: 'Angular: browserslist設定ファイルの削除とオプトイン (v15)'
date: '2022-09-15T00:09:00.000Z'
updated_at: '2022-09-15'
tags:
  - 'angular'
  - 'tech'
  - 'browserslist'
  - 'commit note'
summary: 'Angular CLI は `ng new` や `ng generate application` で生成されるアプリケーションテンプレートから `.browserslistrc` ファイルを削除する。'
draft: false
source: 'https://www.notion.so/Angular-browserslist-v15-5d1a14f0328a4165a2e580e75aefe9ec'
---

Angular CLI は `ng new` や `ng generate application` で生成されるアプリケーションテンプレートから `.browserslistrc` ファイルを削除する。

{{< embed "https://github.com/angular/angular-cli/commit/9beb878e2eecd32e499c8af557f22f46548248fc" >}}

Angular CLI はフレームワークがデフォルトでサポートするブラウザセットを内部で管理しており、同じ設定をすべてのアプリケーションで二重に管理する必要はないとされたためだ。

`ng update` では、プロジェクトの `.browserslistrc` ファイルの内容がデフォルトのままであれば削除され、変更が加えられていればそのまま残される。

Browserslist によるサポート対象ブラウザの拡張がなくなったわけではなく、アプリケーションのテンプレートから削除され、開発者がオプトインで導入するものになったということだ。

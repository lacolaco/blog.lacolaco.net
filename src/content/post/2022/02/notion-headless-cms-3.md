---
title: 'NotionヘッドレスCMS化記録 (3) GitHub Actionsと自動デプロイ'
slug: 'notion-headless-cms-3'
icon: ''
created_time: '2022-02-15T23:13:00.000Z'
last_edited_time: '2023-12-30T10:06:00.000Z'
category: 'Tech'
tags:
  - 'Notion'
  - 'GitHub Actions'
  - 'GitHub'
  - 'Blog Dev'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Notion-CMS-3-GitHub-Actions-47d8a28980af4cd7a9432091d4335b30'
features:
  katex: false
  mermaid: false
  tweet: false
---

https://blog.lacolaco.net/2022/02/notion-headless-cms-2/

前回に引き続き、今回はNotionで書いた記事をGitレポジトリへ自動的に取り込み、Hugoでビルドしてデプロイするまでの流れで躓いた点をまとめる。今回が最終回だ。

## Notionの変更からGitHub Actionsをトリガーしたい

まず思いつくのは Notion のデータベース更新からWebhookを受け取り、GitHub Actionsの `repository_dispatch` トリガーに連携する方法だが、残念ながら今のNotionにはまだWebhook機能がない。

IFTTTやzapierのようなサービスを使うと（何故か）Notionのデータベース変更イベントからアクションできるが、この程度のために外部サービスを使うのも癪なので、愚直ではあるが GitHub Actions の `schedule` トリガーで変更監視を定期実行するようにした。

また、最近のアップデートで `workflow_dispatch` トリガーが追加され、GitHubのUI上から手動でワークフローを開始できるのでデバッグ用に追加して次のようなワークフローができた。

```yaml
name: sync-with-notion

on:
  schedule:
    - cron: '0/10 * * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16.x'
          cache: yarn
      - run: yarn install
      - run: yarn notion:fetch
        env:
          NOTION_AUTH_TOKEN: ${{ secrets.NOTION_AUTH_TOKEN }}
```

### DIffが生まれたらプルリクエストを作る

定期実行するワークフローで Notion API からMarkdownファイルを作成した結果、メインブランチと diff が発生したら、その変更を取り込むためのプルリクエストを自動生成する。これによりNotion の内容が（ほぼ）常にGitレポジトリへ一方的に同期される。

GitHub Actions で何らかのdiffを作ってプルリクエストを作るのは、 `Create Pull Request` アクションが非常に便利だ。一般的なユースケースをカバーした上でいろいろカスタマイズできる。こうしたワークフローで頻発するベースブランチとのコンフリクトや outdated 化などにも自動的に対応してくれる。

[https://github.com/peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)

### botが作ったプルリクエストは別のワークフローをトリガーしない

ところが落とし穴がひとつあった。GitHub Actionsで提供される `secrets.GITHUB_TOKEN` を認証情報としてGitHub APIを呼び出すと、作成したプルリクエストは**別のワークフローをトリガーしない**ことになっている。

https://docs.github.com/en/actions/using-workflows/triggering-a-workflow

> When you use the repository's `GITHUB_TOKEN` to perform tasks, events triggered by the `GITHUB_TOKEN` will not create a new workflow run. This prevents you from accidentally creating recursive workflow runs.

プルリクエストが作成されたら Firebase Hosting のプレビューチャンネルへデプロイして表示確認できるようにしていたため、 Notion 記事反映のプルリクエストからプレビューが作られないのは問題である。

この問題を解決する方法も `Create Pull Request` の作者はフォローしていて、ドキュメントにいくつかの選択肢を載せてくれている。

https://github.com/peter-evans/create-pull-request/blob/main/docs/concepts-guidelines.md#triggering-further-workflow-runs

結局のところ、デフォルトで提供されている `secrets.GITHUB_TOKEN` でさえなければ何でもいいので、今回はトークンのスコープを狭める観点からプライベートの GitHub Apps を使った方法を選んだ。詳細は書かないが、最終的に次のようなワークフローになった。

```yaml
name: sync-with-notion

on:
  schedule:
    - cron: '0/10 * * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '16.x'
          cache: yarn
      # https://github.com/peter-evans/create-pull-request/blob/main/docs/concepts-guidelines.md#authenticating-with-github-app-generated-tokens
      - uses: tibdex/github-app-token@v1
        id: generate-token
        with:
          app_id: ${{ secrets.WORKER_APP_ID }}
          private_key: ${{ secrets.WORKER_APP_PRIVATE_KEY }}
      - run: yarn install
      - run: yarn notion:fetch
        env:
          NOTION_AUTH_TOKEN: ${{ secrets.NOTION_AUTH_TOKEN }}
      - name: Create Pull Request
        uses: peter-evans/create-pull-request@v3
        with:
          token: ${{ steps.generate-token.outputs.token }}
          commit-message: 'fix: apply changes from Notion'
          branch: sync-with-notion
          delete-branch: true
          title: 'fix: apply changes from Notion'
          body: '@lacolaco Review and apply changes from Notion'
```

これで、Notionで記事を書けば約10分後にはGitHubに取り込みプルリクエストが作成され、自動デプロイされたプレビュー環境で表示のチェックができるようになった。完成である。

![image](/images/notion-headless-cms-3/Untitled.png)

NotionにWebhookができればもう少しスマートになるが、今のAPIの使い方でもレートリミットなどは問題なさそうなのでしばらくはこのまま運用する。

https://developers.notion.com/reference/request-limits

## まとめ

3回に分けて、NotionをこのブログのヘッドレスCMSとして使えるようにするにあたって苦労した点をまとめた。ほぼ自分用の備忘録と、実際にNotionで記事を書けると捗るのかどうかの実験を兼ねたものだが、もし似たようなものを作ろうとする誰かの参考になるなら幸いである。

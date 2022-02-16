---
title: 'NotionヘッドレスCMS化記録 (3) GitHub Actionsと自動デプロイ'
date: '2022-02-15T23:13:00.000Z'
updated_at: '2022-02-16T00:44:00.000Z'
tags:
  - 'Notion'
  - 'Markdown'
  - 'GitHub'
  - 'GitHub Actions'
draft: false
source: 'https://www.notion.so/Notion-CMS-3-GitHub-Actions-47d8a28980af4cd7a9432091d4335b30'
---

{{< embed "https://blog.lacolaco.net/2022/02/notion-headless-cms-2/" >}}

前回に引き続き、今回は Notion で書いた記事を Git レポジトリへ自動的に取り込み、Hugo でビルドしてデプロイするまでの流れで躓いた点をまとめる。今回が最終回だ。

## Notion の変更から GitHub Actions をトリガーしたい

まず思いつくのは Notion のデータベース更新から Webhook を受け取り、GitHub Actions の `repository_dispatch` トリガーに連携する方法だが、残念ながら今の Notion にはまだ Webhook 機能がない。

IFTTT や zapier のようなサービスを使うと（何故か）Notion のデータベース変更イベントからアクションできるが、この程度のために外部サービスを使うのも癪なので、愚直ではあるが GitHub Actions の `schedule` トリガーで変更監視を定期実行するようにした。

また、最近のアップデートで `workflow_dispatch` トリガーが追加され、GitHub の UI 上から手動でワークフローを開始できるのでデバッグ用に追加して次のようなワークフローができた。

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

### DIff が生まれたらプルリクエストを作る

定期実行するワークフローで Notion API から Markdown ファイルを作成した結果、メインブランチと diff が発生したら、その変更を取り込むためのプルリクエストを自動生成する。これにより Notion の内容が（ほぼ）常に Git レポジトリへ一方的に同期される。

GitHub Actions で何らかの diff を作ってプルリクエストを作るのは、 `Create Pull Request` アクションが非常に便利だ。一般的なユースケースをカバーした上でいろいろカスタマイズできる。こうしたワークフローで頻発するベースブランチとのコンフリクトや outdated 化などにも自動的に対応してくれる。

[https://github.com/peter-evans/create-pull-request](https://github.com/peter-evans/create-pull-request)

### bot が作ったプルリクエストは別のワークフローをトリガーしない

ところが落とし穴がひとつあった。GitHub Actions で提供される `secrets.GITHUB_TOKEN` を認証情報として GitHub API を呼び出すと、作成したプルリクエストは**別のワークフローをトリガーしない**ことになっている。

{{< embed "https://docs.github.com/en/actions/using-workflows/triggering-a-workflow" >}}

> When you use the repository's `GITHUB_TOKEN` to perform tasks, events triggered by the `GITHUB_TOKEN` will not create a new workflow run. This prevents you from accidentally creating recursive workflow runs.

プルリクエストが作成されたら Firebase Hosting のプレビューチャンネルへデプロイして表示確認できるようにしていたため、 Notion 記事反映のプルリクエストからプレビューが作られないのは問題である。

この問題を解決する方法も `Create Pull Request` の作者はフォローしていて、ドキュメントにいくつかの選択肢を載せてくれている。

{{< embed "https://github.com/peter-evans/create-pull-request/blob/main/docs/concepts-guidelines.md#triggering-further-workflow-runs" >}}

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

これで、Notion で記事を書けば約 10 分後には GitHub に取り込みプルリクエストが作成され、自動デプロイされたプレビュー環境で表示のチェックができるようになった。完成である。

![](/img/notion-headless-cms-3/a77e6ae3-f511-4160-b81b-0582ca167cf7/Untitled.png)

Notion に Webhook ができればもう少しスマートになるが、今の API の使い方でもレートリミットなどは問題なさそうなのでしばらくはこのまま運用する。

{{< embed "https://developers.notion.com/reference/request-limits" >}}

## まとめ

3 回に分けて、Notion をこのブログのヘッドレス CMS として使えるようにするにあたって苦労した点をまとめた。ほぼ自分用の備忘録と、実際に Notion で記事を書けると捗るのかどうかの実験を兼ねたものだが、もし似たようなものを作ろうとする誰かの参考になるなら幸いである。

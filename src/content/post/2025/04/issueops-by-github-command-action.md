---
title: 'GitHub Actions: github/command でIssueOpsを実装する'
slug: 'issueops-by-github-command-action'
icon: ''
created_time: '2025-04-27T13:33:00.000Z'
last_edited_time: '2025-04-27T13:33:00.000Z'
tags:
  - 'GitHub Actions'
  - 'GitHub'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/GitHub-Actions-github-command-IssueOps-1e23521b014a80eea293c9a03f195b00'
features:
  katex: false
  mermaid: false
  tweet: false
---

GitHubが公開している `github/command` アクションを使うと、自分のレポジトリのワークフローに”IssueOps”を簡単に導入できた。

https://github.com/github/command

## “IssueOps” 

`github/command` のREADMEにかかれている説明を引用するとこう定義されている。

> Its like ChatOps but instead of using a chat bot, commands are invoked by commenting on a pull request (PRs are issues under the hood) 

Slackメッセージでワークフローを操作する “ChatOps” のように、GitHubのイシューコメントによってワークフローを操作するのがIssueOpsだ。

GitHubは `github/branch-deploy` という別のアクションも公開している。こちらはデプロイに関する操作に特化したもので、`github/command`は汎用的なものだ。

https://github.com/github/branch-deploy

## 使い方

READMEを見れば全部書いてあるが、次のようなワークフローが基本になる。

```yaml
name: "command demo"

# the workflow to execute on is comments that are newly created
on:
  issue_comment:
    types: [created]

# permissions needed for reacting to IssueOps commands on issues and PRs
permissions:
  pull-requests: write
  issues: write
  checks: read
  contents: read # useful if your workflows call actions/checkout@vX.X.X

jobs:
  demo:
    runs-on: ubuntu-latest
    steps:
      # execute IssueOps command logic, hooray!
      # this will be used to "gate" all future steps below
      - uses: github/command@vX.X.X
        id: command
        with:
          command: ".ping"
          allowed_contexts: issue,pull_request # run on issues AND pull requests

      # run your custom logic for your project here - example seen below

      # conditionally run some logic here
      - name: ping
        if: ${{ steps.command.outputs.continue == 'true' }}
        run: echo "I am going to ping some cool website now!"
```

### トリガー

イシューコメントをトリガーとするため、`issue_comment: created` イベントにフックする。プルリクエストに対するコメントもワークフロートリガーは `issue_comment` だ。

### パーミッション

`github/command` のデフォルトではコメントに対してリアクションによるフィードバックを行う。そのためにイシューとプルリクエストそれぞれへの`write` 権限が必要になる。また、プルリクエストにおいてデフォルトでは他のCIチェックが完了していない状態でコマンドを実行できない。そのチェックのために`checks` 権限も必要になっている。このふるまいは`skip_ci` オプションで無効にできる。

### ステップ

`github/command` アクションの結果を後続のステップの `if` 条件で使うために `id` フィールドを設定する。 `command` オプションは必須で、コマンドを起動する文字列を指定する。

`github/branch-deploy` のデフォルトコマンドがすべて `.start` のようにピリオド始まりなのを踏襲しているのか、`github/command`のドキュメンテーションも `.ping` などピリオド始まりになっているが、実装を読んだところシンプルに`startsWith`しか見てないので、別にどんな文字列でもよい。ただIssueOpsのconventionとしてそういうプロトコルに従うのも悪くない。

### 利用例

このブログはNotionをヘッドレスCMSとして使っている都合、Notionから記事データを取り込む必要がある。そのワークフローを手動でトリガーするための `.sync` コマンドを定義している。

[https://github.com/lacolaco/blog.lacolaco.net/blob/main/.github/workflows/trigger-sync-from-pr-comment.yml](https://github.com/lacolaco/blog.lacolaco.net/blob/main/.github/workflows/trigger-sync-from-pr-comment.yml)

```yaml
jobs:
  trigger-sync:
    runs-on: ubuntu-latest
    permissions:
      pull-requests: write
      issues: write
      checks: read
      actions: write
    steps:
      - uses: github/command@c6920ac0ecbac4544f6f6234d8a02299db570773 # v2.0.0
        id: command
        with:
          command: '.sync'
          allowed_contexts: pull_request
          reaction: 'eyes'
          skip_ci: true
          github_token: ${{ secrets.GITHUB_TOKEN }}
          allowlist: lacolaco
      - name: Trigger Workflow
        if: ${{ steps.command.outputs.continue == 'true' }}
        uses: actions/github-script@60a0d83039c74a4aee543508d2ffcb1c3799cdea # v7.0.1
        with:
          script: |
            github.rest.actions.createWorkflowDispatch({
              owner: context.repo.owner,
              repo: context.repo.repo,
              workflow_id: 'sync-with-notion.yml',
              ref: 'main',
              inputs: {
                forceUpdate: 'false'
              }
            })
```

![image](/images/issueops-by-github-command-action/CleanShot_2025-04-27_at_22.17.422x.844730e887e8f186.png)

もともとは別のサードパーティのアクションを使ってイシューコメントからのワークフロー実行をしていたが、GitHub謹製のものがあるなら信頼性も高いので載せ替えた。

また、デフォルトではイシュー・プルリクエストにコメントできるユーザーなら誰でもコマンドを起動できてしまう。プライベートレポジトリなら気にならないが、パブリックレポジトリであれば`allowlist` オプションでユーザーを絞るのがいい。

トリガーの後ろのコメント本文も後続ステップで取得できるため、`actions/ai-inference`のようなアクションにつなげて自然言語でAIに指示を与えるワークフローを組むのも楽そうだ。

https://github.com/actions/ai-inference


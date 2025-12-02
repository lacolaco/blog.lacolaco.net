---
title: 'Google Cloud の Workload Identity 連携でGitHub Actionsから認証する'
slug: 'github-actions-oidc-google-cloud'
icon: ''
created_time: '2022-07-30T12:36:00.000Z'
last_edited_time: '2022-07-30T00:00:00.000Z'
tags:
  - 'Google Cloud'
  - 'GitHub Actions'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Google-Cloud-Workload-Identity-GitHub-Actions-2f780bc54f7d42d789fd8149884d8233'
features:
  katex: false
  mermaid: false
  tweet: false
---

いまさらだが、秘密鍵を共有する方法ではなく、GitHub Actions のOIDCトークンを使った方法を使ってGCPの認証を有効にしてみたので、その作業メモ。

https://github.blog/changelog/2021-10-27-github-actions-secure-cloud-deployments-with-openid-connect/

https://cloud.google.com/blog/ja/products/identity-security/enabling-keyless-authentication-from-github-actions

基本的には Google Cloud Blog に書いてあるとおりのことをやっただけだが、ほとんどのドキュメントが `gcloud` コマンドを使った設定手順しか説明していないので、あえてWebコンソール上で同等の操作を読み解いて作業した。

## GCP: Workload Identity プロバイダの作成

下の図でいうところの `Cloud Provider` を準備する。GCPではこの部分が **IDプロバイダ** と、それのコンテナになる **Workload Identity プール** という2つのリソースからなる。

![image](/images/github-actions-oidc-google-cloud/Untitled.61162efdf2bb57d3.png)

手順は4つある。

1. **Workload Identity プール**を作成する
1. プールに **IDプロバイダ** を追加する
1. IDプロバイダ と GitHub Actions の OIDCトークンとの**属性マッピング**を構成する
1. **属性条件**を設定する

まず向かう画面は “IAMと管理” のあたりにあるだろう “Workload Identity 連携” というメニュー。「使ってみる」を押すと最初の Workload Identityプール作成が始まる。

![image](/images/github-actions-oidc-google-cloud/Untitled.38690c056c2c732d.png)

### Workload Identity プールを作成する

- 名前を決める
  - たぶんグローバルで一意？名前が十分にユニークならIDと同じになるが、そうでない場合はIDを別に指定することになる
- 説明は任意で、続行する。

![image](/images/github-actions-oidc-google-cloud/Untitled.01f04e4c6d1f8905.png)

### IDプロバイダを追加する

- プロバイダは **OIDC**
- プロバイダの名前を決める
  - これもたぶんグローバルで一意？
- 発行元 (issuer）を指定する
  - このプロバイダに送られるJWTの発行元。GitHub Actions を示す識別子なのでプロジェクトによらず固定
  - `https://token.actions.githubusercontent.com`
- オーディエンスはたぶんデフォルトのままでいい

![image](/images/github-actions-oidc-google-cloud/Untitled.b933d0b482b945c7.png)

### 属性マッピングを構成する

GitHub Actionsから送られてきたJWTのフィールドをIDプロバイダが定義する属性にマッピングする。左側がIDプロバイダの属性で、右側がGitHub ActionsのJWTのフィールド。

![image](/images/github-actions-oidc-google-cloud/Untitled.b15d18fec8843b4c.png)

マッピングが必須なのはおそらく `google.subject` に対する `assertion.sub` をマッピングだけ。残りは属性の条件によってトークン発行を制御するために必要なものを任意に選ぶのでいいはず。

GitHub ActionsのJWTが含んでいるフィールドはここに説明されている。とりあえず重要なのはワークフローを実行したGitHubユーザーのIDが入る `actor` や、ワークフローが実行されたレポジトリ名が入る `repository` などだろうか。ここはプロジェクトのセキュリティ要求によってIDプロバイダに渡さなければならないものが変わるはず。

[https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

### 属性条件を設定する

属性マッピングができたら、属性条件を設定してトークン発行できるリクエスト元を制限する。今回は自分しか触らないレポジトリでの認証なので、「ワークフローの実行者が `lacolaco` である」という条件を書いた。

![image](/images/github-actions-oidc-google-cloud/Untitled.c77fcd174202b731.png)

## GCP: Workload Identityプールにサービスアカウントを追加する

IDプロバイダはGitHub Actionsからのリクエストに応えて一時的なアクセストークンを発行できるようになったが、そのアクセストークンはまだGCP内でなんの権限も持っていない。必要な権限を持ったサービスアカウントとアクセストークンを紐付けしなければならない。

サービスアカウントとアクセストークンの紐付けは、Workload Identity プールからサービスアカウントへのアクセスを許可する必要がある。プールの詳細画面を開き、「アクセスを許可」からサービスアカウントの選択画面が開く。ここでアクセストークンと紐付けたいサービスアカウントを選択する。

![image](/images/github-actions-oidc-google-cloud/Untitled.6a5ee887c3b9e5ff.png)

サービスアカウントはもともとあるものを使いまわすこともできるが、だいたいのケースではGitHub Actionsで行いたいスコープのために新しく作成して権限を絞るはず。

## GitHub Actions の設定

GCP側の作業ができたので、最後にGitHub Actions側を設定して終わりになる。といっても `google-github-actions/auth` アクションがほとんど全部やってくれるので何も難しくない。

https://github.com/google-github-actions/auth

“Usage” にドキュメンテーションされているとおり、`permissions` に `id-token: write` を追記し、`actions/checkout` アクションの **あと** に、次のように認証ステップを追加する。これだけで終わり。

> [!NOTE]
> `permissions` はひとつ設定すると設定していない権限がすべて `none` になるので注意

```yaml
      - uses: actions/checkout@v2
      - id: 'auth'
        uses: google-github-actions/auth@v0.8.0
        with:
          workload_identity_provider: 'projects/381801417627/locations/global/workloadIdentityPools/bq-sandbox-20220730/providers/bq-sandbox-provider-20220730'
          service_account: 'bq-sandbox-worker@lacolaco-net.iam.gserviceaccount.com'
```

- `workload_identity_provider` に指定する値はすこしわかりにくいが、IDプロバイダの編集画面で見れるURIから取り出せる
  ![image](/images/github-actions-oidc-google-cloud/Untitled.8a82b3cde0e627e2.png)
- `service_account` のほうはプールにアクセスを許可したサービスアカウントの中から選んでメールアドレスの文字列を指定する

これだけ書ければ、後続のステップではサービスアカウントの認証が済んだ状態になっている。デフォルトで `export_environment_variables` フラグが `true` なので、多くのGCPのSDKなどが参照する環境変数はセット済みになる。たぶん何もしなくていい。必要があれば `steps.auth.outputs.access_token` などでトークンを参照することもできる。

## サンプル

サンプルとしてGitHub Actionsで実行されたNode.jsのスクリプトでBigQueryのAPIを呼び出している。公開レポジトリにしても大丈夫なのはもちろん属性条件をつけているからで、逆に言えば属性条件をつけなければ他のレポジトリのワークフローでも僕のBigQueryが自由に触れることになると思う。気をつけよう

https://github.com/lacolaco/bq-sandbox/blob/main/.github/workflows/main.yml


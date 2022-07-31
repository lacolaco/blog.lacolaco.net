---
title: 'Google Cloud の Workload Identity 連携でGitHub Actionsから認証する'
date: '2022-07-30T12:36:00.000Z'
updated_at: '2022-07-31T02:36:00.000Z'
tags:
  - 'GitHub Actions'
  - 'Google Cloud'
  - '雑記'
draft: false
source: 'https://www.notion.so/Google-Cloud-Workload-Identity-GitHub-Actions-2f780bc54f7d42d789fd8149884d8233'
---

いまさらだが、秘密鍵を共有する方法ではなく、GitHub Actions の OIDC トークンを使った方法を使って GCP の認証を有効にしてみたので、その作業メモ。

{{< embed "https://github.blog/changelog/2021-10-27-github-actions-secure-cloud-deployments-with-openid-connect/" >}}

{{< embed "https://cloud.google.com/blog/ja/products/identity-security/enabling-keyless-authentication-from-github-actions" >}}

基本的には Google Cloud Blog に書いてあるとおりのことをやっただけだが、ほとんどのドキュメントが `gcloud` コマンドを使った設定手順しか説明していないので、あえて Web コンソール上で同等の操作を読み解いて作業した。

## GCP: Workload Identity プロバイダの作成

下の図でいうところの `Cloud Provider` を準備する。GCP ではこの部分が **ID プロバイダ** と、それのコンテナになる **Workload Identity プール** という 2 つのリソースからなる。

{{< figure src="/img/github-actions-oidc-google-cloud/bd584724-f6ec-4447-9962-b077ad4da1d5/Untitled.png" caption="" >}}

手順は 4 つある。

1. **Workload Identity プール**を作成する
1. プールに **ID プロバイダ** を追加する
1. ID プロバイダ と GitHub Actions の OIDC トークンとの**属性マッピング**を構成する
1. **属性条件**を設定する

まず向かう画面は “IAM と管理” のあたりにあるだろう “Workload Identity 連携” というメニュー。「使ってみる」を押すと最初の Workload Identity プール作成が始まる。

{{< figure src="/img/github-actions-oidc-google-cloud/d39aa217-a01f-4c2b-8a7b-7614b40034b1/Untitled.png" caption="" >}}

### Workload Identity プールを作成する

- 名前を決める
  - たぶんグローバルで一意？名前が十分にユニークなら ID と同じになるが、そうでない場合は ID を別に指定することになる
- 説明は任意で、続行する。
  {{< figure src="/img/github-actions-oidc-google-cloud/5812de6b-2cc9-4049-b85e-b4561c0a4234/Untitled.png" caption="" >}}

### ID プロバイダを追加する

- プロバイダは **OIDC**
- プロバイダの名前を決める
  - これもたぶんグローバルで一意？
- 発行元 (issuer）を指定する
  - このプロバイダに送られる JWT の発行元。GitHub Actions を示す識別子なのでプロジェクトによらず固定
  - `https://token.actions.githubusercontent.com`
- オーディエンスはたぶんデフォルトのままでいい
  {{< figure src="/img/github-actions-oidc-google-cloud/1fd23d3a-98bf-4102-8404-14e46403aab9/Untitled.png" caption="" >}}

### 属性マッピングを構成する

GitHub Actions から送られてきた JWT のフィールドを ID プロバイダが定義する属性にマッピングする。左側が ID プロバイダの属性で、右側が GitHub Actions の JWT のフィールド。

{{< figure src="/img/github-actions-oidc-google-cloud/e13135aa-8a3a-4a50-a464-08baf927afab/Untitled.png" caption="" >}}

マッピングが必須なのはおそらく `google.subject` に対する `assertion.sub` をマッピングだけ。残りは属性の条件によってトークン発行を制御するために必要なものを任意に選ぶのでいいはず。

GitHub Actions の JWT が含んでいるフィールドはここに説明されている。とりあえず重要なのはワークフローを実行した GitHub ユーザーの ID が入る `actor` や、ワークフローが実行されたレポジトリ名が入る `repository` などだろうか。ここはプロジェクトのセキュリティ要求によって ID プロバイダに渡さなければならないものが変わるはず。

[https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)

### 属性条件を設定する

属性マッピングができたら、属性条件を設定してトークン発行できるリクエスト元を制限する。今回は自分しか触らないレポジトリでの認証なので、「ワークフローの実行者が `lacolaco` である」という条件を書いた。

{{< figure src="/img/github-actions-oidc-google-cloud/fa85c010-c61b-4929-b208-41cbd68a0225/Untitled.png" caption="" >}}

## GCP: Workload Identity プールにサービスアカウントを追加する

ID プロバイダは GitHub Actions からのリクエストに応えて一時的なアクセストークンを発行できるようになったが、そのアクセストークンはまだ GCP 内でなんの権限も持っていない。必要な権限を持ったサービスアカウントとアクセストークンを紐付けしなければならない。

サービスアカウントとアクセストークンの紐付けは、Workload Identity プールからサービスアカウントへのアクセスを許可する必要がある。プールの詳細画面を開き、「アクセスを許可」からサービスアカウントの選択画面が開く。ここでアクセストークンと紐付けたいサービスアカウントを選択する。

{{< figure src="/img/github-actions-oidc-google-cloud/4c99f4e5-c85f-4032-808b-c3ab0f9845d3/Untitled.png" caption="" >}}

サービスアカウントはもともとあるものを使いまわすこともできるが、だいたいのケースでは GitHub Actions で行いたいスコープのために新しく作成して権限を絞るはず。

## GitHub Actions の設定

GCP 側の作業ができたので、最後に GitHub Actions 側を設定して終わりになる。といっても `google-github-actions/auth` アクションがほとんど全部やってくれるので何も難しくない。

{{< embed "https://github.com/google-github-actions/auth" >}}

“Usage” にドキュメンテーションされているとおり、`permissions` に `id-token: write` を追記し、`actions/checkout` アクションの **あと** に、次のように認証ステップを追加する。これだけで終わり。

{{< callout "👉">}}
`permissions` はひとつ設定すると設定していない権限がすべて `none` になるので注意
{{< /callout >}}

```yaml
- uses: actions/checkout@v2
- id: 'auth'
  uses: google-github-actions/auth@v0.8.0
  with:
    workload_identity_provider: 'projects/381801417627/locations/global/workloadIdentityPools/bq-sandbox-20220730/providers/bq-sandbox-provider-20220730'
    service_account: 'bq-sandbox-worker@lacolaco-net.iam.gserviceaccount.com'
```

- `workload_identity_provider` に指定する値はすこしわかりにくいが、ID プロバイダの編集画面で見れる URI から取り出せる
  {{< figure src="/img/github-actions-oidc-google-cloud/fd68f5dd-1859-4da2-91ed-e47ac2e70ba6/Untitled.png" caption="" >}}

- `service_account` のほうはプールにアクセスを許可したサービスアカウントの中から選んでメールアドレスの文字列を指定する

これだけ書ければ、後続のステップではサービスアカウントの認証が済んだ状態になっている。デフォルトで `export_environment_variables` フラグが `true` なので、多くの GCP の SDK などが参照する環境変数はセット済みになる。たぶん何もしなくていい。必要があれば `steps.auth.outputs.access_token` などでトークンを参照することもできる。

## サンプル

サンプルとして GitHub Actions で実行された Node.js のスクリプトで BigQuery の API を呼び出している。公開レポジトリにしても大丈夫なのはもちろん属性条件をつけているからで、逆に言えば属性条件をつけなければ他のレポジトリのワークフローでも僕の BigQuery が自由に触れることになると思う。気をつけよう

{{< embed "https://github.com/lacolaco/bq-sandbox/blob/main/.github/workflows/main.yml" >}}

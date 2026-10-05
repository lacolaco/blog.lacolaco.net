data "cloudflare_zone" "this" {
  filter = {
    name = var.zone_name
  }
}

# 名前から permission group の ID を引く。ユーザー向けの一覧を使うのは、アカウント向けの一覧が
# 作成前のトークンでは 403 になりうるため。名前の部分一致で複数返りうるので、名前が完全一致するものだけを取る。
data "cloudflare_api_token_permission_groups_list" "workers_scripts_write" {
  name = "Workers Scripts Write"
}

data "cloudflare_api_token_permission_groups_list" "workers_routes_write" {
  name = "Workers Routes Write"
}

locals {
  cloudflare_account_id = data.cloudflare_zone.this.account.id
  cloudflare_zone_id    = data.cloudflare_zone.this.zone_id

  # Durable Objects には専用の permission group がなく、Workers Scripts Write の範囲で
  # クラス定義とマイグレーションを含むスクリプトをデプロイできる。
  permission_group_workers_scripts_write = one([
    for g in data.cloudflare_api_token_permission_groups_list.workers_scripts_write.result : g.id if g.name == "Workers Scripts Write"
  ])
  permission_group_workers_routes_write = one([
    for g in data.cloudflare_api_token_permission_groups_list.workers_routes_write.result : g.id if g.name == "Workers Routes Write"
  ])
}

# アカウント所有トークンを使う (cloudflare_api_token は作成者個人に紐づくユーザートークン)。
# Cloudflare 公式文書が、CI/CD のように作成者が組織を離れても動き続けるべき連携にはアカウントトークンを
# 勧めているため。値は `cfat_` 接頭辞を持つ。
resource "cloudflare_account_token" "search_deploy" {
  account_id = local.cloudflare_account_id
  name       = "blog-search deploy (GitHub Actions)"

  policies = [
    {
      # Worker スクリプト (Previews の作成・削除と Durable Objects を含む) の編集。対象はこのアカウントのみ。
      effect            = "allow"
      permission_groups = [{ id = local.permission_group_workers_scripts_write }]
      resources = jsonencode({
        "com.cloudflare.api.account.${local.cloudflare_account_id}" = "*"
      })
    },
    {
      # Workers ルート (blog.lacolaco.net/api/search*) の編集。対象はゾーン lacolaco.net のみ。
      effect            = "allow"
      permission_groups = [{ id = local.permission_group_workers_routes_write }]
      resources = jsonencode({
        "com.cloudflare.api.account.zone.${local.cloudflare_zone_id}" = "*"
      })
    },
  ]

  # 有効期限は time_rotating の基準時刻から 1 年。固定の日付だと更新を忘れたときに過去日を送ってしまうため、
  # 基準時刻から導出する。期限なしのトークンは漏えい時の被害期間が無制限になるので避ける。
  expires_on = timeadd(time_rotating.search_deploy_token.rfc3339, "8760h")

  # time_rotating が置き換わる (= ローテーション期限を過ぎた) とトークンも作り直し、新しい期限を得る。
  lifecycle {
    replace_triggered_by = [time_rotating.search_deploy_token]
  }
}

# ローテーション期限の 300 日を過ぎたあとの最初の plan/apply で置き換えが提案される。
# トークンの有効期限 (365 日) より 65 日早いので、その間に apply すれば CI のデプロイは止まらない。
resource "time_rotating" "search_deploy_token" {
  rotation_days = 300
}

# 検索 API の管理用エンドポイントのトークン。記号を除くのは HTTP ヘッダーやシェルで扱いやすくするため。
resource "random_password" "search_admin_token" {
  length  = 48
  special = false
}

# Worker 側の secret への反映は、検索 API の CI がこの GitHub secret から行う (ここでは扱わない)。
resource "github_actions_secret" "cloudflare_api_token" {
  repository      = var.github_repository
  secret_name     = "CLOUDFLARE_API_TOKEN"
  plaintext_value = cloudflare_account_token.search_deploy.value
}

resource "github_actions_secret" "search_admin_token" {
  repository      = var.github_repository
  secret_name     = "SEARCH_ADMIN_TOKEN"
  plaintext_value = random_password.search_admin_token.result
}

# アカウント ID は秘密ではないので variable にする。
resource "github_actions_variable" "cloudflare_account_id" {
  repository    = var.github_repository
  variable_name = "CLOUDFLARE_ACCOUNT_ID"
  value         = local.cloudflare_account_id
}

# 画像 CDN のベース URL も秘密ではないので variable にする。
# R2 のバケットとカスタムドメインはこの構成の管理外 (Terraform のリソースが無い) ため、data source からは引けない。
# そのため値は variables.tf の入力で与える。
resource "github_actions_variable" "image_cdn_base_url" {
  repository    = var.github_repository
  variable_name = "IMAGE_CDN_BASE_URL"
  value         = var.image_cdn_base_url
}

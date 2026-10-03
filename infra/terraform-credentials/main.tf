locals {
  repository = "blog.lacolaco.net"

  cloudflare_account_id = "1b603c7fcf83d8b1d0306c84390c854b"
  # ゾーン lacolaco.net の ID。秘密ではない。
  cloudflare_zone_id = "3a33d35c65800e7c8d15453a85895b78"

  # Cloudflare の permission group ID。`cf user tokens permission-groups list` で取得したもの。
  # Durable Objects には専用の permission group がなく、Workers Scripts Write の範囲で
  # クラス定義とマイグレーションを含むスクリプトをデプロイできる。
  permission_group_workers_scripts_write = "e086da7e2179491d91ee5f35b3ca210a"
  permission_group_workers_routes_write  = "28f4b596e7d643029c524985477ae49a"
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

  # 有効期限は 1 年。期限が切れると CI のデプロイが止まるため、更新手順は README に書いてある。
  # 期限なしのトークンは漏えい時の被害期間が無制限になるので避ける。
  expires_on = var.token_expires_on
}

# 検索 API の管理用エンドポイントのトークン。記号を除くのは HTTP ヘッダーやシェルで扱いやすくするため。
resource "random_password" "search_admin_token" {
  length  = 48
  special = false
}

# Worker 側の secret への反映は、検索 API の CI がこの GitHub secret から行う (ここでは扱わない)。
resource "github_actions_secret" "cloudflare_api_token" {
  repository      = local.repository
  secret_name     = "CLOUDFLARE_API_TOKEN"
  plaintext_value = cloudflare_account_token.search_deploy.value
}

resource "github_actions_secret" "search_admin_token" {
  repository      = local.repository
  secret_name     = "SEARCH_ADMIN_TOKEN"
  plaintext_value = random_password.search_admin_token.result
}

# アカウント ID は秘密ではないので variable にする。
resource "github_actions_variable" "cloudflare_account_id" {
  repository    = local.repository
  variable_name = "CLOUDFLARE_ACCOUNT_ID"
  value         = local.cloudflare_account_id
}

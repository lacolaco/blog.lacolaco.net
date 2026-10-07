# 認証情報はファイルに置かず環境変数で渡す。
#   cloudflare: CLOUDFLARE_API_TOKEN (Account API Tokens Write 等を持つ一時トークン)
#   github:     GITHUB_TOKEN (例: `gh auth token`)
provider "cloudflare" {}

provider "github" {
  owner = "lacolaco"
}

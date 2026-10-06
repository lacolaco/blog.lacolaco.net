# 認証情報はファイルに置かず環境変数で渡す。
#   cloudflare: CLOUDFLARE_API_TOKEN (Account API Tokens Write 等を持つ一時トークン)
#   github:     GITHUB_TOKEN (例: `gh auth token`)
provider "cloudflare" {}

# 認証は gcloud の ADC。Logpush の所有権確認ファイルを GCS から読むためだけに使う。
provider "google" {
  project = "blog-lacolaco-net"
}

provider "github" {
  owner = "lacolaco"
}

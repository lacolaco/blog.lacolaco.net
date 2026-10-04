terraform {
  required_version = ">= 1.14.0"

  required_providers {
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }

  # infra/terraform と同じ bucket を使い、prefix だけ分ける
  backend "gcs" {
    bucket = "blog-lacolaco-net-tfstate"
    prefix = "terraform-github/state"
  }
}

# 認証は環境変数 GITHUB_TOKEN で渡す (例: GITHUB_TOKEN=$(gh auth token))。
# リポジトリの設定を変更する管理者権限を要するため、CI には置かずローカルで apply する。
provider "github" {
  owner = "lacolaco"
}

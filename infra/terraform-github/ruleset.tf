# コードレビューの結果を必須チェックにする ruleset。
#
# 既存の ruleset (main) とブランチ保護には触れない。ruleset は重ねて評価されるため、
# 既存の必須チェックを残したまま code-review-gate を追加できる。
# 既存設定を import して書き換える方式にしないのは、取り込み時の記述の差で
# 既存の必須チェックを意図せず外す (基準を緩める) 危険を避けるためである。
resource "github_repository_ruleset" "require_code_review" {
  name        = "require-code-review"
  repository  = "blog.lacolaco.net"
  target      = "branch"
  enforcement = "active"

  conditions {
    ref_name {
      include = ["~DEFAULT_BRANCH"]
      exclude = []
    }
  }

  # 既存の ruleset (main) と同じく、リポジトリ管理者は PR 経由に限りバイパスできる
  bypass_actors {
    actor_id    = 5 # RepositoryRole: admin
    actor_type  = "RepositoryRole"
    bypass_mode = "pull_request"
  }

  rules {
    required_status_checks {
      required_check {
        # .github/workflows/code-review.yml の job name。
        # レビュー不要の PR でも常に成功を報告するジョブなので、待機中のまま残らない
        context        = "code-review-gate"
        integration_id = 15368 # GitHub Actions
      }
    }
  }
}

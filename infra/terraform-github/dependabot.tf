# 依存の更新は Renovate (.github/renovate.json) に一本化する。
# Dependabot security updates は更新の PR を作るため止める。Dependabot の PR は
# code-review-gate と deploy が通らず、マージできない状態で残るためである。
#
# Dependabot alerts は止めない。Renovate は脆弱性の PR ([security]) の情報源に
# alerts を使うので、止めると脆弱性の更新 PR が出なくなる。alerts はこの
# Terraform の管理に入れず、リポジトリ全体を表す github_repository も取り込まない
# (取り込み時の記述の差で既存設定を意図せず変えないため。ruleset と同じ方針)。
resource "github_repository_dependabot_security_updates" "blog" {
  repository = "blog.lacolaco.net"
  enabled    = false
}

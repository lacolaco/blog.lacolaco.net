# ACL Configuration

このファイルはプロジェクト固有のACL定義を含みます。

<acl:definitions>
obj project = "Astro 5.xベースのブログプロジェクト。Notion CMSと連携し、静的サイトを生成"

fn project.dev(): void {
  description: "開発サーバーを起動"
  action: exec("pnpm dev")
}

fn project.start(): void {
  description: "開発サーバーを起動（project.dev()のエイリアス）"
  action: exec("pnpm start")
}

fn project.build(): void {
  description: "本番用ビルドを実行（Astro静態サイト + Cloudflare Workers）"
  action: exec("pnpm build")
}

fn project.buildForce(): void {
  description: "強制的に本番用ビルドを実行"
  action: exec("pnpm build:force")
}

fn project.preview(): void {
  description: "本番ビルドのプレビューを起動"
  action: exec("pnpm preview")
}

fn project.format(): void {
  description: "Prettierでコードを整形"
  action: exec("pnpm format")
}

fn project.lint(): void {
  description: "ESLintでコード品質をチェック"
  action: exec("pnpm lint")
}

fn project.test(): void {
  description: "全てのツールのテストを実行"
  action: exec("pnpm test:tools")
}

fn project.testNotionFetch(): void {
  description: "notion-fetchツールのテストを実行"
  action: exec("pnpm test:notion-fetch")
}

fn project.testRemarkEmbed(): void {
  description: "remark-embedプラグインのテストを実行"
  action: exec("pnpm test:remark-embed")
}

fn project.notionFetch(): void {
  description: "NotionデータベースからコンテンツをMarkdownに同期"
  action: exec("pnpm notion-fetch")
}

fn project.verify(): void {
  description: "プロジェクトの整合性を検証（lint + format + test + build）"
  action: [
    project.lint(),
    project.format(),
    project.test(),
    project.build()
  ]
}

fn begin(goal): task {
  description: "Begin working on task with git branch and TODO planning; ALWAYS starts from up-to-date origin/main; pairs with finish(task)"
  action: [
    "Switch to main branch with git checkout main",
    "Fetch latest changes with git fetch origin",
    "Update local main with git pull origin main",
    "Create dedicated git branch for the task",
    "Draft initial TODO list based on goal",
    "Request user agreement on approach"
  ]
  returns: "Task object that can be passed to finish(task)"
}

fn finish(task): void {
  description: "Complete task with quality checks, tests, commit, and PR (follows CLAUDE.md mandatory workflow)"
  action: [
    "Clean up and verify all changes are correct",
    project.lint(),
    project.format(),
    project.test(),
    "Stage all relevant files with git add",
    "Create conventional commit with detailed message using git commit",
    "Push to remote branch with git push",
    "Create pull request with gh pr create (include summary and test plan)",
    "Rebase on main if requested with git rebase origin/main",
    "Warn user before force push; only proceed with explicit approval",
    "Force push rebased branch if approved with git push -f"
  ]
}
</acl:definitions>

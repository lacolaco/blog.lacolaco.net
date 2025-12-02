---
title: 'Agent Communication Language'
slug: 'agent-communication-language'
icon: ''
created_time: '2025-10-09T14:33:00.000Z'
last_edited_time: '2025-10-09T15:00:00.000Z'
tags:
  - '雑記'
  - 'AI'
  - 'MCP'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Agent-Communication-Language-2873521b014a809b9010e60a892ed141'
features:
  katex: false
  mermaid: false
  tweet: false
---

**Agent Communication Language (ACL)** というものを作っている。

https://github.com/lacolaco/acl

これは何かというと、Claude Code のようなAIエージェントに指示を出すときに、指示の対象、処理、詳細をできるだけ明確にするためのDSLだ。

たとえば、次のような形で指示を出す。

```typescript
fix("failing tests")                     # Fix issues
refactor("auth module", "extract logic") # Refactor code
test("integration/**")                   # Run tests
project.build()                          # Build project
```

ACLの文法の基本形は `scope.action(details)` だ。`scope` が省略された場合はグローバル関数という扱いになる。たとえば、`project.build()` という指示はプロジェクトのビルドを指示する。

これらの関数は、次のように定義される。

```typescript
fn fix(issue): void {
  description: "Analyze and fix problems"
  action: [
    "Diagnose root cause of the issue",
    "Implement solution",
    "Verify fix works correctly"
  ]
}

fn refactor(targets, direction): void {
  description: "Refactor safely with tests"
  action: [
    test(),
    "Refactor code according to direction",
    test()
  ]
}

readonly fn think(issue): string {
  description: "Analyze issue with read-only operations"
  action: [
    "Investigate using read-only tools (Read, Grep, Glob, WebFetch)",
    "Analyze the problem and provide detailed insights",
    "Present recommendations and potential solutions to user",
    "Wait for explicit user instruction before taking any action"
  ]
  returns: "Analysis, insights, and recommendations as text output only"
}
```

オブジェクトとそのメソッドを定義することもできる。

```typescript
obj project = "Current project context"

fn project.build(): void {
  description: "Build the project"
  action: exec("pnpm run build")
}

fn project.lint(): void {
  description: "Lint the project"
  action: exec("pnpm run lint")
}

fn project.deploy(): void {
  description: "Deploy the project"
  action: exec("pnpm run deploy")
}
```

これらの定義はACLを使う上で必須ではない。プログラミング言語のような見た目をしているが、処理系はLLMなので未定義の関数でも構文でも意味が解釈できれば空気を読んで動作する。とはいえ、毎回解釈を挟むと安定しないので、何度も繰り返す指示は関数として定義してスニペット的に使う。

たとえば次の`begin`/`finish`は僕の個人的なワークフローを関数化している。タスクを始める前に`begin(goal)` を呼び出すと、作業ブランチをmainからチェックアウトし、最初にTODOを整理させる。この関数は`task` スコープを生成する。作業が終わったら`finish(task)`を呼び出すことでGitコミットからプルリクエストの作成までをやってもらう。

```typescript
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
  description: "Complete task with cleanup, tests, commit, and PR"
  action: [
    "Clean up and verify all changes are correct",
    "Run pnpm test to ensure all tests pass",
    "Stage all relevant files with git add",
    "Create conventional commit with detailed message using git commit",
    "Push to remote branch with git push",
    "Create pull request with gh pr create (include summary and test plan)",
    "Rebase on main if requested with git rebase origin/main",
    "Force push rebased branch if needed with git push -f"
  ]
}
```

![image](/images/agent-communication-language/CleanShot_2025-10-09_at_23.17.222x.3c2481988310e156.png)

![image](/images/agent-communication-language/CleanShot_2025-10-09_at_23.18.112x.0c5dcb0866569874.png)

想像力次第で、表現は自由にできる。ACLの仕様を書くのにもACLを使っているが、`spec.refine("add glossary section")` のようなメソッドを呼び出せば仕様書の中に用語集セクションを追加できる。この`spec.refine` は未定義だが、`scope.action(details)` という基本文法に照らして解釈してくれる。

![image](/images/agent-communication-language/CleanShot_2025-10-09_at_23.31.542x.ac8e150980b1d8fd.png)

## Slash commandでよくない？

たぶん実用性で考えたらその通り、それぞれのエージェントが備えているカスタムコマンド機能を使ったほうがいい。

でも僕は指示を考える時に、オブジェクト指向プログラミング的な文法が欲しかったので、ACLは自分のために試しているし、いまのところしっくりきている。

## 試してみたい

MCPサーバーをnpmで公開しているので自由にどうぞ。このMCPサーバーは今のところACL仕様書を返すだけである。

```json
{
  "mcpServers": {
    "acl": {
      "command": "npx",
      "args": ["-y", "@lacolaco/acl@latest"]
    }
  }
}
```

インストラクションでACLという言語でコミュニケーションするつもりがあることを言っておかないとなかなか仕様書を読みに行ってくれないので、次のような指示を入れている。

```markdown
# Communication Language

Choose the appropriate communication language based on the user's message:

- PRIMARY: Agent Communication Language (ACL). Ask ACL MCP Server for details.
```

このあたりはまだ模索中だ。


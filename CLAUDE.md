# CLAUDE.md

---
## 🚨 CRITICAL RULES (STOP IF VIOLATED)
---

These 3 rules are NON-NEGOTIABLE. Violating any = STOP and reassess.

### 1. Pre-Commit Review Gate

**TRIGGER**: After lint/format/build pass, BEFORE `git commit`

For significant changes (new features, refactoring, multi-file):
1. Run code-critic agent
2. Fix all findings
3. Run code-critic AGAIN to verify
4. Only then commit

**"lint/build passed" ≠ "ready to commit"**

**実行タイミング**: PR lifecycle等のワークフローでも、コミット直前に必ず実行する。ワークフローのコミットステップの一部として扱え。

### 2. Deletion Requires Explicit Approval
NEVER delete files/directories without user saying "yes, delete".
- "Check compatibility" ≠ permission to delete
- Show what will be deleted → Wait for approval → Then delete

### 3. TDD is Mandatory
Kent Beck style. Tests = spec. Fix implementation, not tests.

---
## Project Info
---

### Stack
- Astro 5.x blog, Notion CMS, bilingual (ja/en)
- Node.js 24+, pnpm 10.20.0, TS strict
- Astro 5.x+React, Tailwind 4.x
- GCP: Cloud Run
- Cloudflare: R2 (画像CDN), CDN (OG画像キャッシュ)

### Commands
```
pnpm dev          # dev server (USE THIS for iteration)
pnpm build        # production build
pnpm lint         # mandatory pre-commit
pnpm format       # mandatory pre-commit
pnpm test:tools   # all tests
pnpm test:libs    # library tests
```

### Caveats
- `.astro/data-store.json`: Astroのコンテンツキャッシュ。remarkプラグイン等のビルドパイプライン変更時は削除してdevサーバーを再起動しないと反映されない

### Architecture
- Content: Notion→notion-sync→src/content/post/*.md (**DO NOT EDIT**)
- Images: public/images/{slug}/ → R2 CDN経由で配信 (**DO NOT EDIT**)
- Components: .astro (static) / .tsx (interactive)
- i18n: `<slug>.md` (ja), `<slug>.en.md` (en)

### Key Directories
- src/components/: UI components
- src/libs/: internal libraries
- src/pages/: routes, API, OG generation
- tools/: build tools (notion-sync, remark-embed)

---
## Standard Procedures
---

### UI変更の動作確認
- UI変更は必ず自分でブラウザ確認（chrome-devtools等）まで完了させること
- ユーザーに確認を委ねるな。「確認してください」は禁止

### クリーンアップ
- 自分が生成したファイル（スクリーンショット、一時ファイル等）はタスク完了時に必ず削除せよ。放置するな
- 長時間実行コマンド（CI watch、devサーバー等）は常に`run_in_background`で実行すること

### Error Handling
- ANY error = STOP immediately, analyze, report to user
- NEVER chain failed attempts
- NEVER use workarounds (it.skip, eslint-disable)
- Test failures after your changes = assume your fault until proven otherwise

### Before Implementation
1. Search for similar existing code (Glob/Grep)
2. Check if library/pattern already exists
3. Read similar implementations first

### CI失敗時のログ確認（必須）
- CI失敗時は**必ずエラーログを確認してから修正**せよ。推測で修正するな
- **ログを見ずに推測で修正を繰り返すことは禁止**
- ログ確認方法:
  ```bash
  # JAVA_TOOL_OPTIONSからegress proxyを設定してGitHub APIにアクセス
  PROXY_USER=$(echo "$JAVA_TOOL_OPTIONS" | grep -oP '(?<=Dhttps.proxyUser=)[^ ]+')
  PROXY_PASS=$(echo "$JAVA_TOOL_OPTIONS" | grep -oP '(?<=Dhttps.proxyPassword=)[^ ]+')
  PROXY_HOST=$(echo "$JAVA_TOOL_OPTIONS" | grep -oP '(?<=Dhttps.proxyHost=)[^ ]+')
  PROXY_PORT=$(echo "$JAVA_TOOL_OPTIONS" | grep -oP '(?<=Dhttps.proxyPort=)[^ ]+')
  export https_proxy="http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}"

  # check run IDはmcp__github__pull_request_readのget_check_runsで取得
  curl -s "https://api.github.com/repos/lacolaco/blog.lacolaco.net/check-runs/{job_id}/annotations" \
    -H "Accept: application/vnd.github+json"
  ```
- GITHUB_TOKENが環境変数に設定されていれば `gh run view --log` で直接ログ取得可能（#1386参照）
- CIステップにデバッグ出力を追加した場合、修正完了後に必ず削除してci.ymlをmainと同一に戻せ

### Git Operations
- Use git-github-ops agent for complex operations
- NEVER `git reset --hard` with uncommitted changes you need
- pushするとCIは再実行される。古いCI watchの結果は無効
- push後は必ず `gh pr checks --watch` をバックグラウンドで新たに開始せよ。完了したらユーザーに報告すること

### Tool Usage Priority
1. mcp__ide__getDiagnostics (for errors)
2. Read/Edit tools (for files)
3. Bash (last resort, NOT for file editing)

### When User Corrects You
1. 即座にCLAUDE.mdに反映せよ。口頭宣言（「今後は〜します」）は学習ではない。CLAUDE.mdに書いて初めて学習
2. CLAUDE.mdを変更したらコミット→push→CI watchまで一気に実行せよ。途中で止めるな
3. 同じパターンがこのセッション内で再発していないか確認
4. 2回以上同じ指摘を受けた場合: STOP して原因分析

---
## Reference (Look Up When Needed)
---

### Package Management
- Only update explicitly requested packages
- `pnpm add` for runtime, `pnpm add -D` for dev
- Check package.json before adding

### Library Investigation
Before implementing with external libraries:
1. Check latest version/changelog
2. Respect library abstractions (don't bypass)
3. Upgrade before custom implementation

### File Editing
- Read file before Edit/Write
- Match existing patterns (language, format, structure)
- Use Edit tool, not Bash sed/awk

### Agent Outputs
- Never trust without verification
- Read actual files to confirm claims
- Verify before proceeding with agent's plan

### Code Style
- NO `as any`
- Comments in Japanese
- Conventional Commits format
- No emojis unless requested

---
## Feature Documentation
---

### AI Summarizer
- Chrome Summarizer API (Chrome 138+)
- Components: ArticleSummarizer.tsx, src/libs/summarizer/
- Analytics: summarize_start, summarize_complete, summarize_error

### TTS Read-Aloud
- Web Speech API (SpeechSynthesis)
- Components: TTSControls.tsx, src/libs/tts/
- Analytics: tts_start, tts_complete, tts_error

### Image CDN (Cloudflare R2)
- 画像はビルド時にR2 CDN URLに書き換え
- tools/astro-integration-image-cdn/: URL変換Astro integration
- tools/r2-sync/: R2へのアップロードスクリプト
- 環境変数: IMAGE_CDN_BASE_URL
- Dockerイメージから画像除外（.dockerignore）

### Deployment
- GCP Cloud Run via GitHub Actions
- Production: main→deploy-production.yml
- Preview: PR→deploy-preview.yml
- 画像同期: sync-with-notion.yml→R2

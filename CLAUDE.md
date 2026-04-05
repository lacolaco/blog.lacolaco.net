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
- 設計フェーズで検証方法を自然言語ではなく実行可能なテストコードとして書け
- テストは機能レベルで書け。「変更後に何が存在し、何が存在しないか」を両方定義しろ
- テストはデータの発生源で検証しろ。下流（表示層、API層）で検証するな
- 全テストがfailすることを確認してから実装を始めろ
- 全テストがpassしたら実装完了

失敗例（#1367 Channel再設計）:
- ❌ 自然言語の検証項目「Channelページに記事が表示されること」→ 昇格タグの除去漏れを検出できなかった
- ❌ getTags()の戻り値をフィルタするテスト → 表示層のテストでありNotionデータの問題を検出できない
- ✅ markdownのfrontmatterにAngularタグが存在しないことを検証するテスト → データ発生源で検証、表示フィルタでは通らない

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
- スクリーンショットは必ず`filePath`で`/private/tmp/`に保存し、パスをユーザーに伝えること。`filePath`なしの`take_screenshot`はユーザーに表示されない
- 変更前後の比較が必要な場合は、変更前のスクリーンショットも保存してから変更を適用すること
- **未完成品を提示するな。提示は完了宣言と同義**。セルフレビューで発見可能な問題を残したまま見せると信頼を失う。DevToolsの数値一致だけでなくレンダリング結果（font-smoothing、line-height等の視覚的影響）まで検証してから提示せよ
- **ビューポート設定**: `mcp__chrome-devtools__emulate`の`viewport`パラメータを使用すること。`resize_page`はDevToolsパネル分ビューポートが狭くなる
- **全幅検証必須**: UI変更後は最低4幅（375px, 768px, 1024px, 1440px）で確認せよ。1幅だけの確認は検証ではない。変更したコンポーネントだけでなく、それを使う全ページで確認する

### クリーンアップ
- 自分が生成したファイル（スクリーンショット、一時ファイル等）はタスク完了時に必ず削除せよ。放置するな
- 長時間実行コマンド（CI watch、devサーバー等）は常に`run_in_background`で実行すること

### Error Handling
- ANY error = STOP immediately, analyze, report to user
- NEVER chain failed attempts
- NEVER use workarounds (it.skip, eslint-disable)
- Test failures after your changes = assume your fault until proven otherwise

### ドキュメント精読
- ユーザーが「読め」と指示したドキュメントは**Readツールで全文取得**してから行動する。grepでの部分検索は精読の代替にならない
- **メジャーバージョンアップ時は旧知識を全て捨てろ**。新バージョンのREADME/CHANGELOG/Migration Guideを先に読むまで、旧知識に基づく行動（issue作成、方針決定、コード変更）を一切禁止

### 既存コードの修正ルール
- **既存コードの設計意図を問え**。「なぜそうなっているか」が不明なまま修正するな。根拠がレファレンスに基づくか、根拠がないかで対応が変わる
- 根拠不明の設計を表面的な修正（コメント追加等）で済ませない。根拠を確認し、正当ならそのまま、不当なら根本から修正する

### Before Implementation
1. 変更の期待結果をテストコードで書け（何が存在し、何が存在しないか）
2. テストを実行して全て失敗することを確認しろ
3. Search for similar existing code (Glob/Grep)
4. Check if library/pattern already exists
5. Read similar implementations first
6. テストを通す実装を書け
7. **変換・生成ロジックは実データで入出力を検証せよ**。型チェックやビルド成功は変換の正しさを保証しない
8. **仕様書（モックアップ・デザインカンプ・APIスキーマ等）が存在する場合、全プロパティを抽出し実装対象との対応表を作成してから着手せよ**。部分参照で「だいたいこう」で実装に入るな
9. **CSSフレームワーク（Tailwind等）の出力値を暗黙に前提とするな**。DevToolsで実測してから設計判断する。特にメジャーバージョン間で出力が変わる（例: Tailwind 4のoklch色空間、text-smの暗黙line-height）
10. **既存CSSフレームワークとカスタムデザインが衝突する場合、フレームワークの上書き（lg:等）より、カスタムCSS（data属性セレクタ等）で直接記述せよ**。上書きチェーンは予測不能な副作用を生む

### UI設計の原則
- **レファレンス駆動設計**: UIの設計値は自分で決めない。レファレンスサイトの実測値（DevToolsで取得）をベースに設計する。「だいたい合っている」は許容しない
- **設計→実装の順序を破らない**: 情報設計→数値仕様→承認が完了するまでコードに触れるな。設計がうまくいかないことは実装をスキップする理由にならない
- **変更は全体に適用する**: 1箇所の修正が成立したら、同じ原則が適用される全箇所を即座に洗い出して一括修正する。「指摘されたら直す」は手抜き
- **PC/SPは同一設計の適応**: PCとSPで別々にデザインしない。共通の情報構造を先に決め、PC/SPはそのレスポンシブ適応として設計する。構造が異なる場合は設計の誤り
- **品質検証はレファレンスとの差分比較**: 「自分の目で見て良いと思う」は検証ではない。レファレンスと自分の実装を並べ、全要素の位置・サイズ・余白・色を数値で比較して初めて検証になる

### CIレビュー指摘への対応（必須）
- push後、CI code-reviewが完了したら**必ずレビューbodyの指摘を全件読み、全件対応**せよ
- **pushするたびにレビューは新規生成される。前回のレビュー結果は無効**。CI完了後は `./tools/get-latest-review.sh <PR番号>` で現在のHEADに対応するレビューを取得せよ。記憶の中のレビュー結果で作業するな
- 「軽微な指摘」でも無視するな。全件修正するか、修正しない場合はユーザーに判断を仰げ
- **自分の判断で「対応不要」と決めることは禁止**。対応不要の判断はユーザーのみが行える
- **レビューの評価文面を鵜呑みにするな**。「正しい」「問題ない」と書かれていても、指摘対象のコードパスを具体的な入力値（境界値: 0, null, 空文字列等）でトレースして挙動を検証せよ
- CIレビューは指摘ゼロの場合のみapprove・pass。指摘ありの場合はrequest-changes・failでブロックされる。全件解消するまでCIは通らない

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

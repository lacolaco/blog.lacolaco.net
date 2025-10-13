# Git Instructions

このコードベースのGitワークフローと運用ルールを記載します。

## Repository Information

- **Main Repository**: `git@github.com:lacolaco/blog.lacolaco.net.git`
- **Main Branch**: `main`
- **Target Branch for PRs**: `main`
- **CI/CD**: GitHub Actions with automated deployment

## Branch Strategy

### Branch Types

1. **`main`** - メイン開発ブランチ、PRのターゲットブランチ、本番デプロイのソースブランチ
2. **Feature branches** - 機能別開発ブランチ

## Commit Message Guidelines

### Conventional Commits Format

Conventional Commits 仕様に従います:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Commit Types

- **feat**: 新機能追加
- **fix**: バグ修正
- **refactor**: 機能変更を伴わないコードリファクタリング
- **chore**: メンテナンス作業、依存関係更新
- **docs**: ドキュメント更新
- **ci**: CI/CD設定変更
- **test**: テスト追加・修正

### Scope Guidelines

影響範囲を示すスコープ:

- **notion-fetch**: notion-fetch ツールの変更
- **embed**: 埋め込み機能の変更
- **deps**: 依存関係更新
- **ci**: CI/CD関連変更

### 実際のコミット例

```bash
fix(notion-fetch): skip processing if no changes
chore: remove unused cache files
chore(deps): update dependency @iconify/json to v2.2.345
refactor: reduce unnecessary code
feat: render markdown files from notion pages
feat(embed): add Google Slides URL embedding support
```

## Pull Request Workflow

### Creating Pull Requests

1. **Feature branch を `main` から作成**:

   ```bash
   git checkout main
   git pull origin main
   git checkout -b feat-your-feature-name
   ```

2. **TDD ワークフローに従って変更を実装**:

   - テストを先に記述
   - 機能を実装
   - 全てのテストが通ることを確認
   - `pnpm lint` と `pnpm format` を実行

3. **Conventional Commits に従ってコミット**

4. **ブランチをプッシュして PR を作成**:
   ```bash
   git push origin feat-your-feature-name
   # `main` ブランチをターゲットにして PR を作成
   ```

### PR Requirements

- **Target Branch**: 常に `main` をターゲットにする
- **Tests**: 全てのテストが通る必要がある (`pnpm test:tools`, `pnpm test:notion-fetch`, `pnpm test:remark-embed`)
- **Linting**: コードがリンティングを通る必要がある (`pnpm lint`)
- **Formatting**: コードが適切にフォーマットされている必要がある (`pnpm format`)
- **Build**: プロダクションビルドが成功する必要がある (`pnpm build`)

## Development Workflow

### 日常の開発フロー

1. **最新の `main` から開始**:

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Feature branch を作成**:

   ```bash
   git checkout -b feat-your-feature
   ```

3. **TDD プロセスに従う**:

   - 失敗するテストを書く
   - テストを通すための最小限のコードを実装
   - テストを保ちながらリファクタリング
   - 品質チェックを実行: `pnpm lint && pnpm format`

4. **説明的なメッセージで頻繁にコミット**

5. **機能完成時に PR を作成**

### `main` ブランチ運用

- **`main`** がメイン開発ブランチ
- **feature branch** は `main` から作成
- **完成した機能** は PR 経由で `main` にマージ
- **原則として `main` への直接プッシュは避ける** (PR 経由を推奨)

## Deployment

### 自動デプロイ

- **`main` ブランチへの変更** で自動的に本番デプロイがトリガーされる
- **GitHub Actions** によりビルド・デプロイが実行される
- **Google Cloud Run** にコンテナイメージとしてデプロイされる
- **プルリクエスト** に対してはプレビュー環境が自動的に作成される

## 特別なルール

### 編集禁止ファイル

- **`src/content/post/*.md`** - Notion から自動生成されるため直接編集禁止
- これらのファイルは `pnpm notion-fetch` でのみ更新する

### Claude Code 使用時のコミット

**コミット前の必須ステップ:**

1. **全テスト実行**:

   ```bash
   pnpm test:tools
   ```

2. **リンティング実行**:

   ```bash
   pnpm lint
   ```

3. **フォーマット実行**:

   ```bash
   pnpm format
   ```

4. **ビルド確認**:
   ```bash
   pnpm build
   ```

**コミットメッセージテンプレート:**

```
<type>(<scope>): <short description>
```

## Automated Dependency Management

### Renovate Bot

- **依存関係更新の自動PR** が作成される
- **ブランチ命名**: `renovate/<dependency-name>`
- **定期的なレビュー** が必要

### Dependency Update Workflow

1. **Renovate PR を定期的にレビュー**
2. **必要に応じて feature branch で依存関係をテスト**
3. **安全な更新をマージ** (patch/minor バージョン)
4. **破壊的変更を慎重にレビュー** (major バージョン)

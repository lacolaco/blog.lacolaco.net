---
name: deploy-analysis
description: GitHub Actionsのデプロイ実行履歴を分析し、デプロイ時間のトレンド把握と異常検知を行う。「デプロイ分析」「デプロイパフォーマンス」と言われた時に使用。
allowed-tools: Bash, Read, Glob
---

# デプロイパフォーマンス分析

## 目的

**デプロイワークフローの所要時間のボトルネックを特定し、改善案を提示する。**

測定対象はGitHub Actionsの実行ログのみ。ローカル環境での測定は行わない。

## 実行手順

### 1. 最近のデプロイ時間を取得

```bash
gh run list --workflow=deploy-production.yml --limit=10 --json databaseId,startedAt,updatedAt,displayTitle,conclusion
```

結果をパースして以下を計算：
- 各デプロイの所要時間（秒）
- 平均・最大・最小

### 2. Dockerイメージメトリクス取得

特定のRUN_IDのログからイメージメトリクスを抽出：

```bash
# compressed_size_mb を取得
gh run view <RUN_ID> --log 2>&1 | grep "compressed_size_mb"

# layer_count を取得
gh run view <RUN_ID> --log 2>&1 | grep "layer_count"

# exporting/pushing layers 時間
gh run view <RUN_ID> --log 2>&1 | grep -E "(exporting|pushing) layers.*done"
```

### 3. ボトルネック特定

最も遅いデプロイのジョブ別時間を取得：

```bash
gh run view <RUN_ID> --json jobs
```

各フェーズの所要時間と評価基準：

| フェーズ | 正常範囲 | 要改善 |
|----------|----------|--------|
| pnpm build | < 60秒 | > 60秒 |
| Docker export | < 20秒 | > 20秒 |
| Docker push | < 20秒 | > 20秒 |
| Cloud Run deploy | < 60秒 | > 60秒 |
| イメージサイズ | < 300MB | > 300MB |

### 4. 改善案の提示

| ボトルネック | 改善案 |
|-------------|--------|
| pnpm build遅い | キャッシュ設定確認、不要な処理の削除 |
| Docker export遅い | マルチステージビルド最適化、ベースイメージ軽量化 |
| Docker push遅い | .dockerignore確認、不要ファイル除外 |
| イメージサイズ大きい | .dockerignore確認、マルチステージビルド |
| Cloud Run deploy遅い | リージョン設定、min-instances設定 |

## 出力フォーマット

```markdown
## デプロイパフォーマンス分析結果

### デプロイ時間（直近10回）
| # | コミット | 時間(秒) | 状態 |
|---|----------|----------|------|

### 統計
- 平均: XXX秒
- 最大: XXX秒
- 最小: XXX秒

### Dockerイメージメトリクス（最新デプロイ）
- 圧縮サイズ: XX.XXMB
- レイヤー数: XX
- exporting layers: XX.Xs
- pushing layers: XX.Xs

### ボトルネック分析
| フェーズ | 時間/サイズ | 評価 |
|----------|-------------|------|
| Build | XXs | OK/要改善 |
| Docker export | XXs | OK/要改善 |
| Docker push | XXs | OK/要改善 |
| イメージサイズ | XXMB | OK/要改善 |
| Deploy | XXs | OK/要改善 |

### 改善案
- (具体的な改善案を数値根拠とともに提示)
- (改善不要の場合は「現状で最適化済み」)
```

## 注意事項

- ローカルDockerビルドは行わない（CI環境と異なるため無意味）
- `.dockerignore`の変更は行わない（破壊的操作を避ける）
- 改善案は具体的な数値根拠がある場合のみ行う

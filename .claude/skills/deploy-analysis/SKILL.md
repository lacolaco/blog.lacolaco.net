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

デプロイアーティファクトからマニフェストJSONを取得：

```bash
# アーティファクトをダウンロード
gh run download <RUN_ID> -n deploy-metrics-production -D /tmp/deploy-metrics

# マニフェストを分析
cat /tmp/deploy-metrics/manifest.json | jq .
```

#### OCI Image Manifest スキーマ (application/vnd.oci.image.manifest.v1+json)

```typescript
interface OCIImageManifest {
  schemaVersion: 2;                    // 常に2（Docker互換性のため）
  mediaType: string;                   // "application/vnd.oci.image.manifest.v1+json"
  config: Descriptor;                  // イメージ設定への参照
  layers: Descriptor[];                // レイヤー配列（index 0がベースレイヤー）
  annotations?: Record<string, string>;// オプションのメタデータ
}

interface Descriptor {
  mediaType: string;  // コンテンツタイプ
  digest: string;     // "sha256:..." 形式のハッシュ
  size: number;       // バイト単位のサイズ（圧縮後）
  annotations?: Record<string, string>;
}
```

**config.mediaType**: `application/vnd.oci.image.config.v1+json`
**layers[].mediaType**:
- `application/vnd.oci.image.layer.v1.tar+gzip` (gzip圧縮)
- `application/vnd.oci.image.layer.v1.tar+zstd` (zstd圧縮)
- `application/vnd.oci.image.layer.v1.tar` (非圧縮)

#### 分析クエリ例

```bash
# 圧縮サイズ合計（バイト）
jq '[.config.size, .layers[].size] | add' manifest.json

# レイヤー数
jq '.layers | length' manifest.json

# レイヤーごとのサイズ（MB単位、降順でボトルネック特定）
jq -r '.layers | to_entries | sort_by(-.value.size) | .[] | "layer \(.key): \(.value.size / 1024 / 1024 | . * 100 | floor / 100)MB"' manifest.json

# 最大レイヤーの特定
jq '.layers | max_by(.size) | {index: (. as $max | input | .layers | to_entries | map(select(.value.digest == $max.digest)) | .[0].key), size_mb: (.size / 1024 / 1024)}' manifest.json

# 圧縮形式の確認
jq -r '.layers[].mediaType' manifest.json | sort | uniq -c
```

### 3. Docker build時間取得

ログからexporting/pushing時間を抽出：

```bash
gh run view <RUN_ID> --log 2>&1 | grep -E "(exporting|pushing) layers.*done"
```

レイヤー分析の観点：
- 最大レイヤーがボトルネックになりやすい
- 頻繁に変更されるレイヤーが上位にあると毎回再ビルドが発生
- ベースイメージ（通常layer_0）のサイズが大きい場合はベースイメージ変更を検討

### 4. ボトルネック特定

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

### 5. 改善案の提示

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

### レイヤー別サイズ
| Layer | Size | 備考 |
|-------|------|------|
| 0 | XX.XXMB | (ベースイメージ) |
| 1 | XX.XXMB | |
| ... | ... | |

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

# イシューの管理

blog.lacolaco.net のイシューは、Linear の lacolaco チームのプロジェクト `blog.lacolaco.net` に置く。GitHub Issues は使わない。イシューの ID は `LACO-123` の形である。

## 操作

Linear の MCP サーバー (`claude.ai Linear`) のツールで操作する。

| 操作 | ツール | 指定 |
| --- | --- | --- |
| 作成 | `save_issue` | `team: lacolaco`、`project: blog.lacolaco.net`、`title`、`description` |
| 取得 | `get_issue` | イシューの ID |
| 一覧 | `list_issues` | `project: blog.lacolaco.net`、必要に応じて `state`・`label` |
| コメント | `save_comment` | イシューの ID と本文 |
| ラベルの付け外し | `save_issue` | `id` と `addLabels`・`removeLabels` |
| 完了 | `save_issue` | `id` と `state: Done` |
| 取り下げ | `save_issue` | `id` と `state: Canceled`、理由をコメントに書く |

## スクラム

スクラムで進め、このプロジェクトでは次のとおり決める。

- トラッカーとスプリントの単位: Linear の lacolaco チームのプロジェクト `blog.lacolaco.net`
- 表し方:
  - 準備完了: ラベル `ready-for-agent` (人が担当する項目は `ready-for-human`)
  - スプリント: プロジェクトのマイルストーン `Sprint <番号>`
  - スプリントゴール: マイルストーンの説明の1行目に `ゴール: <文>`、2行目に `項目: <識別子の一覧>`
  - 記録: ラベル `sprint-record` を付けたイシュー `Sprint <番号> 記録` へのコメント
  - 改善項目: ラベル `retro-improvement` のイシュー
- スプリントの区切り: ゴール
- プロダクトゴール: 読者が記事を速く正確に見つけられ、その行動をデータで分析して改善できるブログ。
- ステークホルダー:
  - 日本語の読者
  - 英語の読者
  - 運用者 (著者)
  - データの利用者 (lacolaco-dwh で分析する人)
  - SRE (インフラの構成、セキュリティ、コストをまとめて見る)

### 完成の定義

全項目に共通する条件:

- 項目の受け入れ条件をすべて満たす
- CI の全ジョブ (`code-review-gate` を含む) が成功する

変更の種類ごとに加える条件:

- UI: プレビューで 375/768/1024/1440px のスクリーンショットを確かめ、axe-core の違反が 0 件である。
- UI: 操作できる要素の状態 (ホバー、押下中、フォーカス、選択中) ごとに、4つの幅でコントラストを確かめる。
- UI: ポインタを押した位置と離した位置が違う操作 (ドラッグして外へ出るなど) で、意図しない動作が起きない。
- Terraform: plan に想定外の destroy と replace が無い。apply したら、apply 後の状態を確かめる。
- ログやデータを外部へ送る変更: プレビューなど本番以外の環境のデータが、本番の送り先に入らないことを、実物で確かめる。

## Pull Request をトリアージの対象にするか

外部からの Pull Request をトリアージの対象にしない。

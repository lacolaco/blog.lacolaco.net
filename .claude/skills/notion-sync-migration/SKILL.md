---
name: notion-sync-migration
description: "@lacolaco/notion-syncのメジャーバージョンアップを実行する。notion-syncのアップグレード、マイグレーション、バージョンアップと言われた時に使用する。新バージョンが未公開の場合はポーリングで待機する。"
allowed-tools:
  - Read
  - Edit
  - Write
  - Bash(pnpm add:*)
  - Bash(pnpm lint:*)
  - Bash(pnpm build:*)
  - Bash(pnpm notion-sync:*)
  - Bash(npm view:*)
  - Bash(git:*)
  - Bash(gh:*)
  - Bash(sleep:*)
---

# notion-sync Migration

`@lacolaco/notion-sync`のメジャーバージョンアップを安全に実行する。

## 原則

**旧バージョンの知識を全て捨てろ。** 新バージョンのCHANGELOGとREADMEを全文読むまで、コード変更を一切行うな。

## 手順

### 1. 現状確認

```bash
grep "notion-sync" package.json
```

現在のバージョンと、対象バージョンを特定する。

### 2. 新バージョンの取得

対象バージョンがnpmに公開済みか確認する。

```bash
npm view @lacolaco/notion-sync version
```

未公開の場合、バックグラウンドで30秒間隔・最大10分でポーリングする。

```bash
DEADLINE=$((SECONDS + 600))
while [ $SECONDS -lt $DEADLINE ]; do
  version=$(npm view @lacolaco/notion-sync version 2>/dev/null)
  if [[ "$version" == <target-major>.* ]]; then
    echo "published: $version"
    break
  fi
  sleep 30
done
if [ $SECONDS -ge $DEADLINE ]; then
  echo "Timeout: version not published within 10 minutes"
  exit 1
fi
```

### 3. インストール

```bash
pnpm add @lacolaco/notion-sync@<version>
```

### 4. ドキュメント精読（省略禁止）

インストール後、以下を**全文Read**する。grepでの部分検索は精読の代替にならない。

1. `node_modules/@lacolaco/notion-sync/CHANGELOG.md` — Breaking Changesを全て把握
2. `node_modules/@lacolaco/notion-sync/README.md` — 新APIの仕様とMigration Guideを把握

Breaking Changesの一覧を列挙し、現在のコード（`tools/notion-sync/main.ts`）への影響を対応付けてからコード変更に着手する。

### 4.5. データ乖離の事前調査と設計判断の分離

v12→v13ではclient側で生成していた値（slug等）がNotion本体に書き戻されていないケースが顕在化した。同種の乖離が発生する可能性があれば、コード変更前に以下を実施する。

1. 現在の `tools/notion-sync/main.ts` でNotionから読み取らない、client側生成の値を洗い出す
2. 該当プロパティについて、Notion API直接クエリで**実データ**を確認し、manifest/既存成果物とNotion実態の差を定量化する
3. 乖離がある場合、以下を**独立した設計判断**として分離してユーザー承認を得る:
   - **一度きりのデータ復旧（既存URL保持）**: manifest等の値をNotionへ書き戻す一時スクリプト
   - **今後の恒常ロジック**: 新規空ページに対する自動生成・書き戻しの方式。業界標準（WordPress / Hugo / Jekyll / Ghost等）の事前調査を伴う

片方の同意を他方に拡大適用しない。ユーザーが「まず〜だけ」「別問題」と範囲を区切った場合、その区切りを跨ぐ実装を先行させない。

### 5. コード変更

`tools/notion-sync/main.ts`を修正する。

変更時の注意:
- Migration Guideの Before/After に従う
- 型パラメータの追加など、Breaking Change以外の改善も適用する
- 不要になった型アサーション（`as`キャスト）は削除する
- 外部入力からの型変換（`new Date(string)`等）は変換結果のバリデーションとフォールバックを必ず実装する

### 6. 検証

以下を全て通過させる。

```bash
pnpm lint
pnpm notion-sync -- --mode=all
pnpm build
```

**`--dry-run` 単独は検証として不十分。** incremental modeの `--dry-run` は「前回差分なし」で `Fetched 0 pages` になりうる。その状態では新バージョンの `extractMetadata` / `generateFrontmatter` など、検証したいコードパスが一度も実行されない。

**main.tsに書き込み系副作用（Notion APIへのPATCH等）を追加した場合、`pnpm notion-sync` 自体の破壊度が上がる。** 追加前は読み取り専用だったコマンドが本番環境変更を含むようになった時点で、実行前にユーザー承認を再取得する。

`--mode=all` での実行後、以下を確認する:

1. `Sync completed: { succeeded: N, failed: 0 }` のNが想定件数以上
2. 更新された記事のfrontmatter（`git diff content/notion/posts/*.md`）が期待通りのフィールド構成
3. `queryFilter`、`propertyOutputs`、`getImageOutput` が正しく動作した痕跡がログに残っている

「exit 0」だけで検証完了と判断しない。出力に検証対象が実行された痕跡を確認するまで次に進まない。

### 7. 検証副作用の扱い

`--mode=all` は manifest.json と記事mdを実際に更新する。コミット戦略:

- コミット1 (`chore(deps): upgrade ...`): `package.json` / `pnpm-lock.yaml` / `main.ts` / `README.md` のみ
- コミット2 (`chore: sync notion content`): `manifest.json` / 記事md / v12で生成されなくなった既存成果物の削除

移行ロジックの変更と、Notionデータ同期の副作用を別コミットに分離する。

### 8. コミット・PR

通常のpr-lifecycleスキルに従う。

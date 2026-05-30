# Auto Translation 機能設計書

## 概要

Notion 側で `auto_translate` フラグを立てた ja 記事を AI 翻訳して `<slug>.en.md` を自動生成する。手動で en ページを別途作る運用を不要にする。

`notion-sync` とは別個の独立ツール `auto-translate` として実装し、関心を分離する。

## アーキテクチャ全体像

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────────┐
│ Notion Database │────▶│ notion-sync  │────▶│ ja .md (filesys) │
│ (auto_translate │     │ (Notion API) │     │  + auto_translate│
│  property)      │     └──────────────┘     │    フラグを保持   │
└─────────────────┘                          └────────┬─────────┘
                                                      │
                                                      ▼
                          ┌────────────────┐     ┌──────────────────┐
                          │ auto-translate │────▶│ en .md (filesys) │
                          │  (Gemini API)  │     │ auto_translated_ │
                          └────────────────┘     │ from を保持       │
                                                 └──────────────────┘
```

| ツール | 入力 | 出力 | 依存 API |
|---|---|---|---|
| `notion-sync` | Notion DB | `*.md`（frontmatter に `auto_translate` を含む） | Notion API |
| `auto-translate` | filesystem 上の `*.md` | `*.en.md`（frontmatter に `auto_translated_from` を含む） | Gemini API |

両ツールは独立に実行可能:
```bash
pnpm sync         # Notion → markdown
pnpm auto-translate    # ja markdown → en markdown
```

## 制約

| 制約 | 根拠 |
|---|---|
| `notion-sync` と分離した独立ツール `auto-translate` で実装 | 関心の分離: notion-sync は Notion API 専属、auto-translate は markdown 変換専属 |
| 翻訳エンジン: Gemini API (`@google/genai` SDK) | 利用者指定 |
| モデル: `gemini-3-flash-preview` | 利用者指定（preview だが最新世代品質を採用） |
| 翻訳対象判定: filesystem 上の frontmatter のみ参照 | auto-translate ツールは Notion API に触れない（責務分離） |
| 翻訳先: `<slug>.en.md`（既存規約） | `content.config.ts` の glob パターンが既に `**/*.en.md` で en collection を分離 |
| API 障害時: exit 0 でログのみ | auto-translate は cron で 2hr ごと自動実行されるため、一時障害で全停止すると blast radius が大きい |
| 既存 `.en.md` の保全: 翻訳失敗時は上書きしない | Fail-Safe |

## 用語

- **ソース**: 翻訳元の ja 記事 Markdown
- **ターゲット**: 翻訳出力の en 記事 Markdown
- **手動 en ページ**: Notion 側に独立した en ロケールページを作って書いた記事（現状運用）
- **自動 en ページ**: 本機能で生成する `.en.md`

## Notion スキーマ追加（notion-sync 側の対応）

| プロパティ名 | 型 | 用途 |
|---|---|---|
| `auto_translate` | checkbox | true の場合、当該 ja ページを翻訳対象とする |

`tools/notion-sync/main.ts` の対応:
- `BlogPostDatasource` 型に `auto_translate: boolean` を追加
- `BlogPostMetadata` に `auto_translate: boolean` を追加
- `extractMetadata` で値を抽出
- `generateFrontmatter` の戻り値に `auto_translate` を含めて `.md` に書き出す

これだけ。notion-sync は翻訳ロジックには一切関与しない。

## 翻訳対象の決定ロジック（auto-translate 側）

`auto-translate` ツール起動時、`content/notion/posts/*.md` を glob で走査し、以下を**全て**満たすファイルを翻訳対象とする。

1. ファイル名が `<slug>.en.md` ではない（ja ファイルのみ）
2. frontmatter の `locale === 'ja'`
3. frontmatter の `auto_translate === true`
4. **同 slug に対応する手動 en ファイルが存在しない**

### 「手動 en か自動 en か」の判定（filesystem ベース）

`<slug>.en.md` ファイルの frontmatter に `auto_translated_from` フィールドが存在するかで識別する。

| `<slug>.en.md` の状態 | 判定 |
|---|---|
| 存在しない | 未生成。auto_translate=true なら新規翻訳 |
| 存在し、`auto_translated_from` フィールドあり | 過去の自動翻訳結果。キャッシュ判定へ |
| 存在し、`auto_translated_from` フィールドなし | 手動翻訳。**touch しない** |

これにより、auto-translate ツールは Notion API を一切叩かずに「手動 en か自動 en か」を判別できる。notion-sync が手動 en を作っているかどうかは結果として `.en.md` の存在として filesystem に表れる。

### 競合時の挙動

| ja `auto_translate` | 同 slug の `.en.md` 状態 | 動作 |
|---|---|---|
| false | （いずれでも） | 何もしない |
| true | 存在しない | 新規翻訳 |
| true | 自動翻訳結果（`auto_translated_from` あり） | キャッシュ判定 |
| true | 手動翻訳（`auto_translated_from` なし） | **touch しない**。警告ログ |

### `auto_translate` を true → false に戻したとき

対応する `.en.md` が `auto_translated_from` フィールドを持つ（= 自動翻訳結果である）場合、**ファイルを削除する**。

| 条件 | 動作 |
|---|---|
| ja `auto_translate=false` + 同 slug `.en.md` 不在 | 何もしない |
| ja `auto_translate=false` + 同 slug `.en.md` あり、`auto_translated_from` あり | `.en.md` を削除、ログ出力 |
| ja `auto_translate=false` + 同 slug `.en.md` あり、`auto_translated_from` なし（手動 en） | **何もしない**。手動 en は保護 |

削除ログ例: `[auto-translate] removed orphaned auto-translation: <slug>.en.md (auto_translate flag turned off)`

## 翻訳パイプライン

### 実行単位

`auto-translate` は独立した実行可能スクリプト。`pnpm auto-translate` で起動。

```
auto-translate main
  ├─ content/notion/posts/*.md を glob で走査
  ├─ 翻訳対象を決定（前節のロジック）
  ├─ 各対象に対して translateOne() を順次実行
  └─ 結果集計（translated/skipped/failed）をログ出力
  exit 0（API 失敗があっても）
```

### CI 統合

`.github/workflows/sync-with-notion.yml` で `pnpm sync` の後段ステップとして `pnpm auto-translate` を実行する。両者の入出力は filesystem で疎結合。

```yaml
- run: pnpm sync
  env:
    NOTION_AUTH_TOKEN: ${{ secrets.NOTION_AUTH_TOKEN }}
- run: pnpm auto-translate
  env:
    GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
```

auto-translate のステップは sync の後段だが、独立コマンドなので失敗しても sync の結果に影響しない。再翻訳のみを試したい場合は `pnpm auto-translate` 単体で実行可能。

### `translateOne(jaFilePath)` の流れ

```
1. ja ファイル読み込み
2. frontmatter / 本文の分離（gray-matter）
3. body_hash 算出: sha256(jaBody + jaTitle + PROMPT_VERSION + MODEL_ID)
4. 対応する <slug>.en.md パスを算出して読み込み（あれば）
5. 既存 en の判定:
   - en 未存在 → 新規翻訳パスへ
   - 既存 en に auto_translated_from なし → 手動翻訳と判定し touch せず終了
   - 既存 en に auto_translated_from あり → キャッシュ判定へ
6. キャッシュ判定:
   a. 既存 en の auto_translated_from === body_hash:
      → 翻訳結果は再利用可能。API は呼ばない
      → 既存 en の本文を流用しつつ、frontmatter は ja から再構築
      → 結果が既存 en と同一なら書き込みもスキップ（full cache hit）
   b. 不一致:
      → Gemini 呼び出し（入力: {title, body} → 出力: {title_en, body_en}）
      → 構造検証 OK → en 全体を書き出し
      → 構造検証 NG → 既存温存・ログ
```

### 二段キャッシュの意図

- **API 呼び出しは body+title 変更時のみ**（最も高コストな処理を最小化）
- **frontmatter コピーフィールド（tags/channels 等）は ja を常に正とする**（API 呼ばないので追加コスト 0）
- Notion 上の誤タップ・published フラグトグル等で `last_edited_time` だけが変わっても、本文 hash が変わらなければ API は呼ばれない

### 構造検証

翻訳前後で以下のカウントが一致しなければ採用しない。LLM の構造破壊を検知する最後の砦。

| 検査項目 | 抽出方法 |
|---|---|
| コードブロック数 | ``` で囲まれたブロックを `mdast` パースで数える |
| 画像数 | `![...](...)` の出現数 |
| リンク数 | `[...](...)` の出現数（画像を除く） |
| **bare URL paragraph 数** | 単独行 URL（前後空行・1行・URL のみ）の数 |
| `:::` ディレクティブ数 | 将来用 |

bare URL paragraph は `tools/remark-embed` の embed 変換対象。翻訳で URL の前後に英語テキストが付くと embed として認識されなくなるため重要。

### 構造検証失敗時のリトライ（エラーフィードバック付き）

検証不一致時、不一致内容を Gemini にフィードバックして最大 **3 回** まで再翻訳を試みる。

```
試行 N（N=1..4）→ 構造検証
  ├─ OK: 採用、ループ脱出
  └─ NG: N < 4 なら差分メッセージを生成して N+1 回目へ。N == 4 なら採用せず既存温存
```

差分メッセージは毎回最新の翻訳結果と source の差分から生成し、user message として追加する。

リトライ上限は 3 回（合計最大 4 リクエスト）。理由:
- 1 回目失敗 → フィードバックで改善余地あり
- 2-3 回目: 確率的揺らぎで成功する可能性が残る
- 4 回連続失敗は入力構造そのものが LLM に難しい兆候。それ以上の試行は期待値が下がりコスト過大
- 失敗時は既存 en 温存で公開品質は保たれる

### フィードバックメッセージ生成

不一致のあった全項目を列挙する形式。例:

```
The translation has structural mismatches with the source:
- Code blocks: source has 3, translation has 2
- Bare URL paragraphs: source has 5, translation has 4

Please retranslate ensuring all code blocks, links, images, and bare URL paragraphs from the source are preserved exactly. Do not omit, merge, or wrap any URL into prose.
```

### ログ出力

| 状況 | ログレベル | メッセージ例 |
|---|---|---|
| 試行 N (1-3) 失敗 → リトライ | warn | `[auto-translate] structure mismatch (attempt N/4) for {slug}: codeBlocks ja=3 en=2 — retrying` |
| リトライ成功 | info | `[auto-translate] structure validation passed on attempt N for {slug}` |
| 4 試行全失敗 | error | `[auto-translate] structure mismatch persisted after 4 attempts for {slug}, keeping existing .en.md` |

### Gemini への入力（YAML を渡さない）

frontmatter は **parse 済みの string フィールドのみ**を渡す。LLM に YAML 文字列を見せない。

```typescript
// 入力
{
  title: ja.title,    // 翻訳対象
  body: ja.body,      // 翻訳対象（markdown 文字列）
}
// 出力（responseSchema で型強制）
{
  title_en: string,
  body_en: string,
}
```

### プロンプト指針（実装時に詳細確定）

- 自然な英語技術ブログ調（既存 `.en.md` のスタイルを参考）
- 不変対象: コードブロック内のコード、URL、画像パス、bare URL paragraph、katex `$...$`、mermaid ``` ``` ``` 内
- markdown 構造（見出しレベル、リスト、コードブロックの言語タグ）を保持
- 出力は frontmatter を含まない本文 markdown のみ

### `PROMPT_VERSION` 定数

プロンプト文字列が変わったら必ずインクリメントする整数定数。`translator.ts` 内に定義し、ハッシュ計算に含める。プロンプト更新で全記事再翻訳をトリガーするスイッチ。

## frontmatter 変換ルール

ja frontmatter を base に以下を変換して en frontmatter を作る。

| フィールド | 変換 |
|---|---|
| `title` | Gemini 翻訳結果に置換 |
| `slug` | そのままコピー |
| `icon` | そのままコピー |
| `created_time` | そのままコピー（同じ記事なので作成日時は同一） |
| `last_edited_time` | **ja の last_edited_time** をコピー（翻訳実行時刻ではない） |
| `tags` | そのままコピー |
| `channels` | そのままコピー |
| `published` | そのままコピー |
| `locale` | `'en'` に上書き |
| `category` | そのままコピー |
| `canonical_url` | そのままコピー |
| `notion_url` | ja の値をコピー（en ページが Notion 側に存在しないため） |
| `features` | そのままコピー |
| `auto_translated_from` | **新規追加**: `sha256(jaBody + jaTitle + PROMPT_VERSION + MODEL_ID)` の hex 文字列 |

### 既存の手動 en ページとの差別化

`auto_translated_from` フィールドの存在で「自動生成された en か」を識別できる。将来手動修正したい場合、このフィールドを削除すればキャッシュ判定で「未翻訳扱い」にならず、かつ手動修正版として保護される設計にできる（v2 で検討）。v1 では「手動 en と自動 en は同 slug で共存しない」前提なので、識別子の用途は将来のためのマーカーに留める。

## キャッシュ戦略

`auto-translate` は cron で 2hr ごとに走る。全 auto_translate 記事を毎回翻訳するとコスト・レート制限・無駄が大きい。

### キャッシュキー（body_hash）

```
sha256(jaBody + jaTitle + PROMPT_VERSION + MODEL_ID)
```

翻訳対象である本文・タイトルのみをハッシュに含める。Notion 側の誤タップ・プロパティトグル等で `last_edited_time` だけが変わっても、本文ハッシュが同一なら API は呼ばない（無駄な課金防止）。

### キャッシュ判定の二段構造

| 状態 | API 呼び出し | en ファイル書き込み |
|---|---|---|
| en 未存在 | あり | 全体書き出し |
| en の `auto_translated_from` ≠ 新 body_hash | あり | 全体書き出し |
| en の `auto_translated_from` === 新 body_hash かつ frontmatter copy 結果が既存 en と一致 | なし | スキップ |
| en の `auto_translated_from` === 新 body_hash かつ frontmatter copy 結果が既存 en と相違 | なし | frontmatter のみ更新（本文流用） |

これにより:
- **API 課金は本文・タイトル変更時のみ**
- **tags / channels / canonical_url 等の ja 編集は API 呼ばずに en へ追従**
- **何も変わっていない sync では書き込みも発生しない**

### キャッシュ無効化トリガー

| トリガー | 結果 |
|---|---|
| ja 本文 or title 編集 | body_hash 変化 → API 呼ぶ → 全体再生成 |
| ja の tags / channels / canonical_url 編集 | body_hash 不変 → API 呼ばず → en frontmatter のみ更新 |
| ja の last_edited_time のみ変化（誤タップ等） | body_hash 不変 → 何もしない |
| `PROMPT_VERSION` インクリメント | body_hash 変化 → 全記事再翻訳 |
| `MODEL_ID` 変更（env 経由） | body_hash 変化 → 全記事再翻訳 |

## モデル設定

| 項目 | 値 |
|---|---|
| デフォルトモデル | `gemini-3-flash-preview` |
| env 上書き | `GEMINI_MODEL` |
| API キー env | `GEMINI_API_KEY` |
| SDK | `@google/genai`（runtime dep として `package.json` に追加） |

preview モデルゆえ API 仕様変更・廃止リスクあり。env 上書きで stable (`gemini-2.5-flash`) に切り替えられる構造にしておく。

## エラーハンドリング

| 障害 | 対処 |
|---|---|
| `GEMINI_API_KEY` 未設定 | auto-translate 全体を skip して exit 0。「GEMINI_API_KEY 未設定により auto-translate を skip」を1度だけログ出力 |
| Gemini API ネットワークエラー | 当該記事 skip、次記事へ。ログ出力 |
| Gemini API レート制限 (429) | 当該記事 skip、次記事へ。ログ出力 |
| Gemini レスポンスが responseSchema に合わない | 当該記事 skip、既存温存 |
| 構造検証失敗 | 当該記事 skip、既存温存 |
| ファイル書き込みエラー | プロセス継続、エラーログ |
| ja `.md` ファイル不在 | auto-translate は何もしない（sync の責任範囲） |

CI exit code は 0 維持。**翻訳の失敗は CI を落とさない**（cron 自動実行で偶発的失敗が多発するため）。

## レート制限・並列度

v1 では**逐次実行**（並列度 1）。理由:
- 個人ブログの記事数規模では十分
- Gemini の rate limit を意識せずに済む
- 失敗診断が容易

将来的に記事数増加で必要になれば並列化する。

## 環境変数 / Secrets

| 変数 | 必須/任意 | 用途 |
|---|---|---|
| `GEMINI_API_KEY` | 任意（未設定なら機能 skip） | Gemini API 認証 |
| `GEMINI_MODEL` | 任意 | モデル ID 上書き（デフォルト `gemini-3-flash-preview`） |

### Secrets 設定

| 環境 | 値 |
|---|---|
| GitHub Secrets (`GEMINI_API_KEY`) | Google AI Studio で発行したキー |

`.github/workflows/sync-with-notion.yml` の env に `GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}` を追加。

`.env.example` に `GEMINI_API_KEY=` を追加（ローカル実行用）。

## ローカル実行

```bash
# Notion から markdown を取得
NOTION_AUTH_TOKEN=xxx pnpm sync

# ja markdown を翻訳して .en.md を生成
GEMINI_API_KEY=xxx pnpm auto-translate

# 翻訳のみ再実行（Notion 取得をスキップ）
GEMINI_API_KEY=xxx pnpm auto-translate
```

`pnpm auto-translate` は API キーなしでも exit 0（何もせずログのみ）。

## ファイル構成

### 新規ツール

```
tools/auto-translate/
├── main.ts                       # エントリーポイント（pnpm auto-translate）
├── translator.ts                 # Gemini 呼び出し・キャッシュ判定
├── translator.spec.ts
├── structure-validator.ts        # 構造検証
├── structure-validator.spec.ts
├── frontmatter.ts                # ja → en frontmatter 変換
├── frontmatter.spec.ts
├── discover.ts                   # 翻訳対象 glob + 判定
├── discover.spec.ts
└── README.md
```

### 既存ツールへの変更

```
tools/notion-sync/main.ts  # auto_translate プロパティ抽出と frontmatter 出力のみ追加
```

### package.json scripts

```json
{
  "scripts": {
    "sync": "tsx tools/notion-sync/main.ts",
    "auto-translate": "tsx tools/auto-translate/main.ts"
  }
}
```

### 公開 API

```typescript
// tools/auto-translate/main.ts
async function main(): Promise<void>;

// tools/auto-translate/translator.ts
export async function translateOne(
  jaFilePath: string,
  options: { apiKey: string; model: string }
): Promise<TranslateResult>;

export type TranslateResult =
  | { kind: 'translated' }       // API 呼んで書き出し
  | { kind: 'frontmatter-only' } // frontmatter のみ更新
  | { kind: 'skipped' }          // 何もしない
  | { kind: 'manual-en' }        // 手動 en あり、touch せず
  | { kind: 'removed' }          // auto_translate=false により削除
  | { kind: 'failed'; reason: string };
```

## テストプラン

### `structure-validator.spec.ts`（先に書く）

| # | テスト | 期待 |
|---|---|---|
| 1 | コードブロック数一致 | true |
| 2 | コードブロック数不一致 | false + reason |
| 3 | 画像数一致 | true |
| 4 | 画像数不一致 | false |
| 5 | リンク数一致 | true |
| 6 | bare URL paragraph 一致 | true |
| 7 | bare URL が翻訳で文に巻き込まれた | false |
| 8 | bare URL とリンクの区別 | bare のみカウント |

### `discover.spec.ts`（先に書く、filesystem モック）

各 ja ファイルを以下のアクションに分類する:

| # | テスト | 期待アクション |
|---|---|---|
| 9 | ja + auto_translate=true + 同 slug `.en.md` なし | translate |
| 10 | ja + auto_translate=true + 同 slug `.en.md` あり（auto_translated_from 有） | evaluate-cache |
| 11 | ja + auto_translate=true + 同 slug `.en.md` あり（auto_translated_from 無） | protect-manual（警告ログ） |
| 12 | ja + auto_translate=false + 同 slug `.en.md` なし | skip |
| 13 | ja + auto_translate=false + 同 slug `.en.md` あり（auto_translated_from 有） | delete-orphan |
| 14 | ja + auto_translate=false + 同 slug `.en.md` あり（auto_translated_from 無） | skip（手動 en は独立、touch しない） |
| 15 | locale=en + auto_translate=true | skip（en は翻訳ソースになり得ない） |
| 16 | frontmatter parse エラー | skip + エラーログ |

### `frontmatter.spec.ts`（先に書く）

| # | テスト | 期待 |
|---|---|---|
| 15 | locale が `'en'` に置換 | en |
| 16 | auto_translated_from が付与 | hex 64 chars |
| 17 | title が翻訳結果に置換 | 翻訳後 |
| 18 | tags / channels / canonical_url / category / notion_url / icon / created_time / last_edited_time / published / features がコピー | 同値 |
| 19 | ja に存在しない passthrough フィールド | en にも引き継がれる |

### `translator.spec.ts`（先に書く、Gemini SDK モック）

**ハッシュ計算 (3)**

| # | テスト | 期待 |
|---|---|---|
| 20 | 同入力 → 同ハッシュ | 一致 |
| 21 | PROMPT_VERSION 変更 → 別ハッシュ | 不一致 |
| 22 | MODEL_ID 変更 → 別ハッシュ | 不一致 |

**キャッシュ判定 (5)**

| # | テスト | 期待 |
|---|---|---|
| 23 | body_hash 一致 + frontmatter コピー結果も既存 en と同一 | API 呼ばず、書き込みも skip |
| 24 | body_hash 一致 + ja の tags 変更 | API 呼ばず、frontmatter のみ更新 |
| 25 | body_hash 不一致（本文編集） | API 呼ぶ、全体書き出し |
| 26 | 既存 en なし | API 呼ぶ、全体書き出し |
| 27 | ja の last_edited_time のみ変化、本文同一 | API 呼ばず、書き込みも skip |

**Gemini 連携 (8)**

| # | テスト | 期待 |
|---|---|---|
| 28 | API 正常応答 + 構造検証 OK | en ファイル書き出し |
| 29 | API 5xx | skip、既存温存 |
| 30 | API 429 | skip、既存温存 |
| 31 | responseSchema 違反レスポンス | skip、既存温存 |
| 32 | 構造検証 NG → 1 回目リトライで OK | 採用、API 呼び出し 2 回 |
| 33 | 構造検証 NG → 2 回連続失敗 → 3 回目で OK | 採用、API 呼び出し 3 回 |
| 34 | 構造検証 NG → 4 試行全失敗 | skip、既存温存、error ログ、API 呼び出し 4 回 |
| 35 | リトライ時のフィードバックメッセージに差分が含まれる | "Code blocks: source has N" 等を含む |
| 36 | リトライ上限は 3 回（合計試行 4 回まで） | API 呼び出し回数 ≤ 4 |

### 受け入れテスト（手動、CI 外）

| # | 検証 | 方法 |
|---|---|---|
| 37 | 既存 ja 記事 1 本でローカル実行し en 生成 | `GEMINI_API_KEY=xxx pnpm auto-translate` 後、生成 .en.md を目視確認 |
| 38 | コードブロック・画像・bare URL が破壊されていない | Astro ビルドして該当ページを表示確認 |
| 39 | 2 回連続実行でキャッシュヒットして API 呼ばれない | ログ確認 |
| 40 | 手動 en（auto_translated_from 無）が touch されない | 既存手動 en の mtime が変わらないこと |
| 41 | auto_translate を true→false に変更 → `.en.md` が削除される | filesystem 確認 |
| 42 | 手動 en の ja で auto_translate=false にしても削除されない | 既存ファイルが残っていること |

翻訳品質はユニットテストでは保証できない。手動レビュー前提。

## PR 分割

| PR | スコープ | 依存 |
|---|---|---|
| 1 | 本 design doc | なし |
| 2 | notion-sync の `auto_translate` プロパティ抽出と frontmatter 出力 | PR1 |
| 3 | `auto-translate/structure-validator.ts` + spec | PR1 |
| 4 | `auto-translate/frontmatter.ts` + spec（ja→en 変換） | PR1 |
| 5 | `auto-translate/discover.ts` + spec（翻訳対象判定・filesystem ベース） | PR1 |
| 6 | `auto-translate/translator.ts` + spec（SDK モック）+ `@google/genai` 追加 | PR3, PR4 |
| 7 | `auto-translate/main.ts` 統合 + `pnpm auto-translate` script 追加 | PR2, PR5, PR6 |
| 8 | GitHub Secrets 設定 + `sync-with-notion.yml` への auto-translate ステップ追加 + `.env.example` 追加 | PR7（マージ後に手動で Secrets 設定） |

PR2-PR5 は並列開発可能。PR6 が結合点。

## オープン論点（design doc レビュー時に決定）

1. プロンプト本文の最終形（受け入れテスト記事の出力品質を見て調整）
2. preview モデル廃止時の自動フォールバック実装の要否（v1 では env 切替手動でよいか）
3. `auto_translated_from` 以外の追加メタデータ（翻訳実行時刻、token 使用量）を frontmatter に持つか
4. v2 で「手動修正された自動 en」を保護する識別マーカーの設計

## コスト見積もり（参考）

| 項目 | 値 |
|---|---|
| 1 記事あたり token | 入力 ~3K、出力 ~3K（実測で精緻化） |
| Gemini 3 Flash 単価 | preview のため変動可能性あり、暫定 2.5 Flash 同等を想定 |
| 同単価想定: 入力 $0.075/M、出力 $0.30/M | 1 記事 ~$0.001 |
| キャッシュヒット時 | $0 |
| 月額（ja 記事新規・更新が 30 件と仮定） | <$0.05 |

実際の値は preview モデルの公式価格表で確定する。

# Bilingual List Display 設計書

## 背景

`auto-translate` の導入により、`auto_translate: true` フラグが付いた ja 記事は en 版が自動生成され `<slug>.en.md` として配置される。これにより同一 slug で ja / en 2 つの content entry が存在するようになった。

その結果、HTML list page (`/`, `/channels/<channel>`, `/tags/<tag>`, `/tags/`) で同一記事の ja 版と en 版が重複して表示される問題が発生した。

例 (channels/Code):

```
2026-04-08  Angular v22: debounced Resource の解説       (ja)
2026-04-08  Angular v22: Explaining debounced Resource   (en, EN badge)
```

## 採用方針: Option D (per-entry locale-aware switch)

list の構造 (どの記事が並ぶか・順序・件数) は **そのまま** 維持し、bilingual な記事 (en 版が存在する記事) のみ user の locale で title / href を切り替える。

### 動作仕様

- list は ja を canonical entry として 1 記事 1 行で表示する (slug ベース dedup)
- 各 entry は build 時に bilingual flag (en 版が存在するか) と en metadata (en title, en href) を持つ
- client-side で `navigator.languages` を見て user locale を判定:
  - locale が en preference (e.g., `en-*` が `ja-*` より優先): bilingual entry の表示を en に swap
  - それ以外 (ja preference / 不明): ja 表示のまま
- 非 bilingual entry (en 版なし) は常に ja 表示 (swap 対象外)

### この採用が他 option より優れる理由

- **A (両方表示)**: 同一記事が list の 2 行を消費して読み手を混乱させる
- **B (en を list から除外)**: en 訪問者が list 経由で en に到達できない (動線喪失)
- **C (locale 別 list 分離)**: ルーティング新設 + navigation UI 追加で大規模 rework
- **D**: list の本数も順序も変えず、各 entry が「読み手の locale に合った表示」になる。bilingual な記事だけ表示が動的に切り替わる

### 評価軸での position

1. 読み手体験: ja 読者は ja のまま、en 読者は bilingual 記事を en で読める
2. 実装コスト: build 時に metadata を attach + 小さい client-side script 追加
3. 将来拡張性: locale 数を増やすときも metadata 追加と判定ロジック拡張で対応可能
4. SSG 制約: build 時 HTML には ja を入れる (no-JS 環境では ja で表示される) + JS で swap する progressive enhancement

## 実装方針

### Build-time (Astro)

1. `queryAvailablePosts` の結果に対して `deduplicatePosts` で 1 slug 1 entry に絞る (ja 優先)
2. 各 entry に「対応する en 版が存在するか」のフラグと、存在する場合は en title / href を計算して attach
   - 例: `{ post: jaEntry, bilingual: { en: { title: '...', href: '...' } } | null }`
3. List コンポーネントは、bilingual がある entry に `data-bilingual-title-en` / `data-bilingual-href-en` を埋め込む

### Client-side

1. 小さい script (no framework) を List page にロード
2. `navigator.languages` を確認:
   - en が ja より先 → en preference
   - ja が先 or どちらも無し → ja のまま
3. en preference の場合、`[data-bilingual-href-en]` を持つ要素の text content と href を data 属性の値に置換

### SEO / no-JS / 直接 link 対応

- 検索エンジンは ja の HTML を index する (canonical URL は ja)
- en 版は個別 URL (`<slug>.en.md` 由来の en page) で別途 index される
- no-JS 環境 (古 browser / search bot) では ja のまま表示 (機能劣化なし)
- 英語ユーザが list の en title をクリックしたら en page に直行 (動線維持)

### 影響範囲

- `src/libs/query/posts.ts`: `queryAvailablePosts` の結果に bilingual metadata を attach する関数を追加 (新規 / 既存 dedup を再利用)
- `src/layouts/List.astro` (または子 component): bilingual の場合 `data-*` 属性を埋め込む
- `src/scripts/bilingual-swap.ts` (新規) or 同等の inline script: client-side swap 実装
- `src/pages/index.astro` / `channels/[channel].astro` / `tags/[tag].astro` / `tags/index.astro`: 上記の bilingual-aware query を使用するよう変更

`tags/index.astro` の `usedCount` 計算は dedup 済み posts に対して行うことで `[tag].astro` の表示件数と一致する。

## トレードオフ / 承認事項

1. **client-side JS 必須**: no-JS で en preference な訪問者は ja で表示される (劣化はあるが致命的ではない、SEO 経由の en 直接リンクで補える)
2. **ja を canonical**: HTML 初期表示は ja。これは og:title / RSS / 検索 index の挙動と整合する
3. **locale 判定ロジック**: `navigator.languages` の最初に `en` を含む要素が `ja` より先に出現 = en preference、という単純判定で開始。明示切替 (UI による toggle) は将来の拡張
4. **bilingual の対応関係**: ja の slug に対応する en は `<slug>.en.md` で 1:1 (複数言語に拡張する場合の対応関係は将来別 design doc)

## 関連 / 別 design doc 化対象

- en frontmatter の `created_time` / `last_edited_time` が ja から copy されている件 (timestamp 問題) は本 design の対象外
- 明示的な language toggle UI (button / pulldown) は将来拡張として別 design doc

## 実装の前提

- 本 design doc 承認後に実装 PR を出す
- PR #1586 (Option B 実装で merged) は PR #1587 で revert 中

# Bilingual List Display 設計書

## 背景

`auto-translate` の導入により、`auto_translate: true` フラグが付いた ja 記事は en 版が自動生成され `<slug>.en.md` として配置される。これにより同一 slug で ja / en 2 つの content entry が存在するようになった。

その結果、HTML list page (`/`, `/channels/<channel>`, `/tags/<tag>`, `/tags/`) で同一記事の ja 版と en 版が重複して表示される問題が発生した。

例 (channels/Code):

```
2026-04-08  Angular v22: debounced Resource の解説       (ja)
2026-04-08  Angular v22: Explaining debounced Resource   (en, EN badge)
```

## 解決方針の選択肢

### Option A: 現状維持 (両方表示)

- list に ja と en 両方を並べる
- en は EN badge で識別
- pros: シンプル、コード変更なし
- cons: 同一記事が 2 行を消費、読み手に「別記事のようで実は同じ」混乱を与える、article count が 2 倍に

### Option B: 重複時 ja 優先で en を list から除外

- 同 slug が ja/en 両方ある場合、list には ja のみ表示
- en は個別 URL (`/posts/<slug>` の en 版) では引き続き accessible
- 既存関数 `deduplicatePosts` (`src/libs/query/posts.ts`) がこの方針を実装済み (RSS feed では既に使用)
- pros: 簡素、現行 codebase との整合性 (RSS と同方針)、article count 維持
- cons: en 訪問者が list 経由で en に到達できない (URL を直接知る必要がある)

### Option C: locale 別に list を分離

- `/` は ja list 専用、`/en/` (新設) は en list 専用
- 各 list は単一 locale のみ表示
- pros: locale ごとの独立した動線、UI 上の混乱なし
- cons: ルーティング新設 (`/en/`, `/en/channels/`, `/en/tags/` 等)、navigation UI 追加、Astro の i18n routing に依存
- 既存実装との関係: RSS feed は既に `index.xml` (ja preferred via dedup) と `index.en.xml` (en filter) で分離されている。HTML 側の対応物がない

### Option D: locale-aware 自動切り替え

- 訪問者の `Accept-Language` / 明示選択 / cookie 等で locale を判別し、対応する list を表示
- pros: 自然な user experience
- cons: SSG (Astro static build) では不可能 (build 時に確定する)、CDN edge / client side で工夫必要

## 評価軸

1. **読み手体験**: 同一記事が 2 度現れるのは混乱の元。何らかの解決必須
2. **実装コスト**: 既存 codebase (`deduplicatePosts` 既存、RSS は分離済み) との整合性
3. **将来拡張性**: 他言語 (zh 等) 追加時の影響
4. **build 時静的決定**: Astro SSG 前提

## 推奨

**Option B (ja 優先 dedup)** を推奨。

理由:
- 既存の `deduplicatePosts` 関数で実装済み、RSS feed (`index.xml.ts`) で同方針が運用されている
- HTML list と RSS feed で挙動を揃えることで読み手の混乱を防ぐ
- 実装変更は 4 ページ (`index.astro` / `channels/[channel].astro` / `tags/[tag].astro` / `tags/index.astro`) に `deduplicatePosts` を追加するだけ
- en の単独訪問は個別 URL で可能なので、SEO / 直接リンク経由の到達は維持される

Option C (locale 別 list 分離) は将来の拡張として残し得るが、現時点で en への直接の流入経路 (Twitter シェア、検索等) があれば list 経由のニーズは限定的。Option C を選ぶなら Astro i18n routing への移行を含む大規模な rework になる。

## トレードオフ承認事項

Option B を採用する場合、ユーザに承認を求めるべき暗黙の決定:

1. **ja 優先**: 同 slug 両方ある時 ja を残す (en を残す選択もあり得る)
2. **en の list 動線喪失**: en は個別 URL でしか辿れなくなる (英語圏の読み手が trade されている可能性)
3. **timestamp 問題は別件**: en frontmatter の `created_time` / `last_edited_time` が ja から copy されている問題は本 design の対象外。別 design doc で扱う

## 実装方針 (Option B 採用時)

`src/libs/query/posts.ts` の `deduplicatePosts` を以下の page で適用:

- `src/pages/index.astro`
- `src/pages/channels/[channel].astro`
- `src/pages/tags/[tag].astro`
- `src/pages/tags/index.astro`

各ページで `deduplicatePosts(await queryAvailablePosts())` の形で呼び出す。

RSS feed の `index.xml.ts` は既に dedup 適用済みなので変更不要。`index.en.xml.ts` は locale='en' フィルタなので変更不要。

## 未決事項

- Option A / B / C / D のどれを採用するかは PO 判断
- 採用 option ごとに timestamp 問題 (en の date 表示) をどう扱うかは別 doc 化

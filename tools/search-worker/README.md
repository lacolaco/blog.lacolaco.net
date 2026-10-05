# search-worker

サイト内検索 API。Cloudflare Workers の `blog-search` が HTTP を受け、同じ Worker に含まれる Durable Object (`SearchDO`、SQLite ストレージ) の SQLite FTS5 (trigram) を引く。UI はこのディレクトリの範囲外。

## 構成

| パス                     | 内容                                                                                                             |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `search.ts`              | 索引の入れ替えと検索の SQL。Cloudflare にも Node にも依存しない純粋な関数。Worker と品質テストが同じコードを使う |
| `http.ts`                | CORS、管理用トークンの照合、入力の検証                                                                           |
| `plain.ts`               | markdown を検索用の平文にする。ビルド (`src/pages/search-docs.json.ts`) と品質テストが同じ関数を使う             |
| `worker/index.ts`        | Worker の入口と Durable Object。`worker/tsconfig.json` は Workers の型で検査する                                 |
| `wrangler.jsonc`         | Worker の設定。本番 (トップレベル) と Preview (`previews` ブロック)                                              |
| `push-index.ts`          | CI が記事データを管理用エンドポイントへ送る                                                                      |
| `*.spec.ts`, `fixtures/` | 品質テストと HTTP の判定のテスト。`pnpm test:tools` で実行される                                                 |

置き場所を `tools/` にしたのは、`test:tools` (node:test) と lint、format の対象に入り、ビルドなしで CI のテストを実行できるため。pnpm のワークスペースにはしていない。Docker イメージの `pnpm install` と lockfile に影響を与えないため。

## API

```
GET /api/search?q=<語>&locale=ja|en
```

上位 20 件の `{ slug, title, date, channels, snippet, highlights }` を関連度順に返す。

- `date` は `yyyy-MM-dd` (Asia/Tokyo)、`channels` は一覧 (`List.astro`) と同じ並び順。どちらも `src/pages/search-docs.json.ts` が一覧と同じ取得元から作る。
- `q` は空白区切りの AND 検索。3 文字以上の語は FTS5 の trigram で引き、3 文字未満の語は本文への LIKE で絞る。大文字小文字は trigram の既定 (`case_sensitive 0`) に任せる。全角と半角などの表記ゆれは、索引と検索語の両方に NFKC 正規化を掛けて吸収する。
- `snippet` は一致箇所の周辺を切り出した平文 (HTML ではない。改行を含まない)。`highlights` は `snippet` の中の一致範囲で、`[start, end)` の UTF-16 の位置 (JS の `slice` と同じ数え方) の組の配列である。昇順で、互いに重ならない。本文に一致が無い (題名だけの一致の) 結果は `highlights` が空で、`snippet` は本文の先頭になる。
  - 変更前は `snippet` だけで (約 50 文字、一致箇所なし)、UI が本文を再走査して強調していた。`snippet` は平文のまま残し、`highlights` を足した。

  ```json
  {
    "snippet": "…<loading-wrapper [loading]=\"isLoading$ | async\"> <div>Done!</div> </loading-wrapper>…",
    "highlights": [
      [1, 8],
      [19, 26]
    ]
  }
  ```

  - 強調するときは、`snippet` を `highlights` で分割し、一致部分を `<mark>` などの要素の `textContent` にする。`snippet` を HTML として挿入してはならない。一致箇所を本文の文字列に埋め込む形 (`<mark>` や `**` で囲んだ文字列) にしなかったのは、本文に `<` や `&` が含まれると、HTML として解釈される危険と、本文由来の記号と区別できない曖昧さが生じるため。位置の組なら、本文を一切加工せずに済み、文字列として表示するだけで安全である。
  - 位置は、索引に入っている NFKC 正規化後の本文での位置である。`snippet` は正規化後の文字列 (全角の英数字は半角になる) で、`highlights` はその `snippet` の位置を指す。
  - 3 文字以上の語の一致は、FTS5 の `highlight()` が挟む区切り文字 (本文に出ない制御文字 U+0001、U+0002。索引に入れる時に本文と題名から取り除く) から求める。エンジンが一致と判定した範囲だけが入る。trigram は部分文字列一致なので、`loading` は `Preloading` の途中にも一致する。隣り合う一致 (`changeDetection` の `change` と `Detection` など) は `highlight()` の仕様で 1 つの範囲になる。
  - 3 文字未満の語は FTS5 を使わず LIKE で絞るので、LIKE と同じ判定 (ASCII の大文字小文字を区別しない部分一致) の出現位置を範囲にする。3 文字以上と 3 文字未満の語が混在するクエリでは両方の範囲が入る。
  - 抜粋の長さは約 160 文字 (文の境目を探すので最大でおよそ 260 文字)。FTS5 の `snippet()` は 64 トークンまでで、trigram では約 66 文字にしかならないため使わず、`highlight()` で本文全体の一致を得て、一致が最も多く入る範囲を文の境目 (`。` `！` `？` `.` など) で切り出す。省略した側には `…` を付ける。

- 検索語は構造化ログ (`console.log` の JSON 1 行: `event`、`q`、`locale`、`hits`、`ms`) に出る。Workers Logs で検索できる。

## 索引の更新

デプロイのたびに全件を入れ替える。

1. ビルドが `dist/client/search-docs.json` を出力する (公開済みの記事 `queryAvailablePosts`。`.dockerignore` で Docker イメージから除外している)。
2. CI が `push-index.ts` で `PUT /api/search/admin/index` に送る (`Authorization: Bearer <SEARCH_ADMIN_TOKEN>`)。
3. Durable Object が `transactionSync` の中で表を作り直して全件を入れ直す。

- 入れ替えは 1 つのトランザクションで、途中で失敗したらロールバックされて古い索引が残る。
- Durable Object は 1 つのスレッドで動き、`transactionSync` は同期で完結するため、入れ替え中の検索は終わるまで待たされる。検索が古い索引と新しい索引の混在を見ることはない。
- SQLite を使う Durable Object の制限 ([公式](https://developers.cloudflare.com/durable-objects/platform/limits/)): SQL 文は 100 KB、束縛変数は 100 個、1 行は 2 MB まで。1 記事を 1 行にしており、現在の最大の本文は約 46 KB。FTS5 の内部表の書き込みも同じトランザクションに入る。378 記事の入れ替えは約 2 秒。
- 管理用エンドポイントは Worker の secret `ADMIN_TOKEN` で保護する。値は GitHub の secret `SEARCH_ADMIN_TOKEN` で、CI が `--secrets-file` で Worker に渡す。

## 環境

### 本番

`main` への push で `deploy-production.yml` が `wrangler deploy` を実行し、`push-index.ts` で索引を入れる。`blog.lacolaco.net/api/search*` のルートが Worker に向く。Cloud Run の他の `/api/*` (`/api/likes` など) は対象外。Durable Object は `apac-ne` の `locationHint` で作る (最初の `get()` にだけ適用される)。

### Preview

PR ごとに `wrangler preview --name pr-<番号>` で [Workers の Previews](https://developers.cloudflare.com/workers/previews/) を作る。Preview は本番の設定を継承せず、Durable Object の名前空間とストレージが Preview ごとに自動で別になる。本番や他の PR の索引とは混ざらない。

- Preview URL の発行には Worker の `preview_urls: true` が要る。routes があると既定が false になり、URL が空になる。本番の workers.dev は `workers_dev: false` で公開しない。
- `deploy-preview.yml` が Preview を作り、その Preview URL (workers.dev) へ索引を入れる。サイトのビルドには環境変数 `PUBLIC_SEARCH_API_URL` で URL を渡す。
- Preview の Worker は別オリジンなので、`previews.vars.ALLOWED_ORIGIN_PATTERN` に一致する Cloud Run のプレビューのオリジンにだけ CORS を許可する。
- `shutdown-preview.yml` が PR を閉じたときに `wrangler preview delete` で Preview を削除する。Durable Object のデータも一緒に消える。
- 作りたての Preview や、削除してから同名で作り直した Preview は、Durable Object が使えるようになるまで数秒から十数秒、検索が 500 を返す。`push-index.ts` は待って再試行する。

## 道具

デプロイと Preview の操作には `cf` ではなく `wrangler` を使う。

- `cf previews` には `deploy` しかなく、Preview の削除と secret の設定ができない。1 つの道具で完結させるため `wrangler` に揃えた。
- `cf` はプロジェクトのビルド道具を `<プロジェクト>/node_modules` から探し、プロジェクトの直下に Astro があると `astro build` を実行する。このリポジトリでは使えない。
- Cloudflare 上のリソース (トークン、ゾーン、Worker の一覧など) の参照と作成は `cf` を使ってよい。

## 認証情報

| 名前                    | 場所               | 内容                                                                               |
| ----------------------- | ------------------ | ---------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | GitHub の secret   | Workers Scripts Write (アカウント) と Workers Routes Write (ゾーン `lacolaco.net`) |
| `CLOUDFLARE_ACCOUNT_ID` | GitHub の variable | アカウント ID                                                                      |
| `SEARCH_ADMIN_TOKEN`    | GitHub の secret   | 管理用エンドポイントのトークン (Worker の `ADMIN_TOKEN` に渡る)                    |

値はリポジトリに置かず、GitHub に登録されている前提で動く。

## ローカルでの確認

```bash
pnpm exec tsx --test tools/search-worker/*.spec.ts   # 品質テスト (ビルド不要)
pnpm exec tsc -p tools/search-worker/worker/tsconfig.json
pnpm exec wrangler deploy --dry-run -c tools/search-worker/wrangler.jsonc
```

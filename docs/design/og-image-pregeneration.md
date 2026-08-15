# OGP画像の事前生成設計書

## 概要

OGP画像をリクエスト時のオンデマンド生成からCIでの事前生成に移し、R2から配信する。

## 現状

| 項目 | 内容 |
|------|------|
| URL | `/og/<slug>.png?t=<last_edited_time>` |
| 生成 | Cloud Run上のSSRルート `src/pages/og/[slug].png.ts` (`prerender = false`) |
| 描画 | satori (JSX→SVG) + `@resvg/resvg-js` (SVG→PNG) |
| キャッシュ | `max-age=86400, s-maxage=86400, stale-while-revalidate=86400` でCloudflare CDN |

記事更新でクエリ `t` が変わりURLが変わるため、CDNキャッシュは実質的に永続する。生成が走るのは記事あたり数回で、取得するのは主にSNSのクローラーである。

### 現状の問題

| 問題 | 内容 |
|------|------|
| ja/enの取り違え | `[slug].png.ts:11` が `find(post => post.data.slug === slug)` でlocaleを見ずに検索する。jaとenは同じslugを共有するため、ja記事のカードに英語タイトルが出る (本番で確認済み) |
| SSRルートの存在 | 静的サイトでありながらオンデマンドレンダリングが必要な理由がOGP画像だけになっている |

## 目的

| 目的 | 内容 |
|------|------|
| SSRルートの削減 | `prerender = false` のルートを3つから2つ (likes API、embed) にする |
| 初回レイテンシの排除 | 事前生成により、クローラーが生成完了を待つ状態をなくす |
| ja/enの分離 | localeごとに正しいタイトルの画像を配信する |

## 制約

| 制約 | 根拠 |
|------|------|
| R2への書き込み経路は1つ | 同一バケットへの書き込みを複数パイプラインが持つと所有者が曖昧になる。既存の r2-sync (blog-contents) に一本化する |
| デザインを変更しない | `#1753` のレイアウトを維持する |
| satori / resvg を置き換えない | Node上で動作しており、変更する理由がない |
| 画像をリポジトリにコミットしない | 368枚で約75MB。生成物でありmarkdownから再生成できる |

## アーキテクチャ

### 責務の分割

| リポジトリ | 責務 |
|-----------|------|
| blog.lacolaco.net | 画像の描画ロジック、hashの算出、マニフェストの読み取り |
| blog-contents | 生成の起動、R2へのアップロード、マニフェストを含むPRの作成 |

blog.lacolaco.net はR2に書き込まない。既存の `sync-blog-lacolaco.yml` が blog.lacolaco.net をチェックアウトしているため、生成スクリプトはそこから実行する。

### パイプライン

```
blog-contents: sync-blog-lacolaco.yml
  1. sync が記事を content/ に書き出す                    (既存)
  2. blog.lacolaco.net で pnpm install                   (追加)
  3. OG画像を生成し og-manifest.json を更新               (追加)
  4. public/images を R2 にアップロード                   (既存。og も対象になる)
  5. cross-repo PR を作成                                (既存。og-manifest.json を add-paths に追加)

blog.lacolaco.net: deploy-production.yml
  変更なし
```

### アトミック性

`og:image` のURLをビルド時にhashから組み立てず、マニフェストから読む。これにより「デプロイ時点で画像がR2に存在すること」をデプロイパイプラインが保証する必要がなくなる。

R2へのアップロード (手順4) はPR作成 (手順5) より前に完了する。PRに含まれるのはマニフェストだけなので、マージされた時点で参照先の画像は必ずR2に存在する。

レンダラ実装を変更した場合も同様に成立する。main への push で `trigger-sync-from-pr-comment.yml` が blog-contents へ `repository_dispatch` を送り、sync が起動して全記事を再生成する。マージされるまでマニフェストは古いファイル名を指し、古い画像もR2に残っているため、切り替わりの瞬間まで参照が壊れない。

## ファイル名

```
<slug>.<locale>.<hash>.png
```

| 要素 | 根拠 |
|------|------|
| slug | 記事の識別子 |
| locale | jaとenは同じslugを共有する (`assertUniqueSlugs` は `locale:slug` をキーにする)。R2上で言語版を判別するために必要 |
| hash | 内容が変わると別ファイルになる。イミュータブルに扱えるため `max-age=31536000, immutable` を付与できる |

R2上のキーは `og/<slug>.<locale>.<hash>.png`、配信URLは `https://images.blog.lacolaco.net/og/<slug>.<locale>.<hash>.png` となる。

## hashの算出

`src/libs/og-image/hash.ts` (PR #1962 でマージ済み)。

```
hash = sha256(rendererFingerprint + "\0" + markdown全文).slice(0, 16)
```

### 入力

| 入力 | 内容 |
|------|------|
| markdown全文 | frontmatter を含む記事ファイルの全内容 |
| rendererFingerprint | 描画結果を左右する実装と依存から算出した指紋 |

markdown全文を入力にするのは、frontmatter に title があり、本文だけでは題名の変更を検知できないためである。副作用として `last_edited_time` だけが変わる編集 (タグ変更等) でもhashが変わり再生成が走るが、描画結果は同じで害はない。

ビルド時とCIが同じ値を導出しなければ `og:image` が存在しないオブジェクトを指すため、入力の取り違えを防ぐ `computeOgImageHashFromFile(filePath)` を唯一の入口とする。

### rendererFingerprint

| 入力 | 対象 |
|------|------|
| 実装ファイルの内容 | `image.tsx` / `constants.ts` / `avatar.png` / `font-loader.ts` / `tools/og-image-sync/render.ts` / `tools/og-image-sync/fonts.ts` |
| 依存の解決済みバージョン | `satori` / `@resvg/resvg-js` / `budoux` / `date-fns` / `@date-fns/tz` |
| 依存のsnapshot | 上記各依存がlockfile上で直接引き込む依存の一覧 |

手動のバージョン番号では更新漏れを検知できない。R2オブジェクトはイミュータブルなため、hashが変わらなければ古い描画が永久に配信され続ける。

依存バージョンの出所は `pnpm-lock.yaml` の `importers['.']` とする。`package.json` の宣言は caret レンジを含みlockfileだけの更新を取りこぼす。node_modules の実バージョンはインストール状態に左右される。

snapshotを入力に含めるのは、satori のレイアウトを `yoga-layout` / `@shuding/opentype.js` / `linebreak` が担っており、satori 自身のバージョンが動かないまま描画が変わりうるためである。捕捉できるのは1階層下までで推移的閉包ではない。lockfile全体をハッシュすれば取りこぼしはなくなるが、無関係な依存更新のたびに全記事が再生成されるため採らない。

### 捕捉できない変更

`font-loader.ts` は生成のたびにGoogle Fonts CSS2 APIへフォントを取りに行くため、Google側でグリフやhintingが更新されても指紋は変わらない。描画が変わったのに再生成されない状況になった場合は、`RENDERER_SOURCE_FILES` のいずれかを編集して全記事の再生成を強制する。

## マニフェスト

`og-manifest.json` をリポジトリのルートに置く。

```json
{
  "<slug>.<locale>": "<slug>.<locale>.<hash>.png"
}
```

| 項目 | 内容 |
|------|------|
| 生成 | blog-contents の sync ワークフローが更新する |
| 参照 | blog.lacolaco.net のビルドが読み、`og:image` のURLを組み立てる |
| git管理 | する。前回のhashを保持し、差分生成の判定に使う |

画像そのものは `.gitignore` に `public/images/og/` を追加してgit管理から外す。r2-syncはディレクトリをスキャンするためgit管理は不要である。

### マニフェストはCIが所有する

マニフェストのエントリは「そのファイル名の画像がR2に存在する」という主張である。画像をgit管理しないため、ローカルで生成した結果をコミットすると、CIのチェックアウトには画像がないのにマニフェストだけが埋まった状態になる。この状態では差分判定が全件を「生成済み」と判断し、R2には何もアップロードされない。

したがってローカル実行の結果はコミットしない。段階3の初回生成を成立させるため、リポジトリには空のマニフェストを置く。以降はCIが更新した内容をPR経由でコミットする。

r2-syncは `continue-on-error: true` で実行されるため、アップロードが失敗してもマニフェストだけが進む可能性がある。その場合は該当エントリを削除して再実行する。

## 生成スクリプト

`tools/og-image-sync/`。

| モジュール | 責務 |
|-----------|------|
| `discover.ts` | 記事ファイルの列挙、frontmatterからの対象抽出、公開判定、hashの算出 |
| `fonts.ts` | フォントの一括取得。以降はローカルで解決する |
| `render.ts` | satori + resvg による描画 |
| `manifest.ts` | マニフェストの読み書き、差分判定、切り詰めの防止 |
| `main.ts` | 全体の進行と逐次のマニフェスト更新 |

### localeの判定

ファイル名が `.en.md` で終わるかどうかで決める。`src/content.config.ts` の collection も同じ規則で locale を上書きしているため、frontmatter の locale を出所にすると両者がずれる。

### 差分判定

マニフェストに記録されたファイル名と、算出したファイル名を比較する。一致する場合は生成しない。

| ケース | 生成枚数 | 所要時間 (実測1枚380ms) |
|--------|---------|------------------------|
| 記事1件の更新 | 1〜2枚 | 1秒未満 |
| レンダラ実装の変更 | 368枚 | 約140秒 |

### フォントの取得

Google Fonts CSS2 API はサブセットを `text` パラメータで決めるため、記事ごとに描画すると記事数×3回の問い合わせが発生する。全記事のタイトルをまとめて1回で取得し、以降はローカルで解決する。

サブセットの構成は描画結果に影響しない。全368記事の和集合・単一タイトル・記事ごと取得の3通りで同一記事を描画し、PNGがバイト単位で一致することを実測で確認している。

### 予約投稿の扱い

公開判定は生成時点の時刻で行う。公開日が未来の記事は対象外となるが、その日付が到来しても生成は自動では起動しない。sync が動くのはNotionの更新か main への push のときだけである。予約投稿が公開された直後は、次に何らかの同期が走るまでOG画像を持たない。

### 古い世代の扱い

参照されなくなった画像はR2に残す。削除は行わない。イミュータブルなファイル名のため上書きは発生せず、残存しても害はない。ストレージコストは1枚205KBで無視できる。

## 参照側の変更

| ファイル | 変更内容 |
|---------|---------|
| `src/layouts/PostDetailPage.astro:47` | `image` propをマニフェスト由来のCDN URLにする |
| `src/components/BaseHead.astro:69-78` | `og:image` のホストを `location.origin` に置換するスクリプトを削除する。CDN URLになるため置換すると壊れる |
| `src/pages/og/[slug].png.ts` | 削除する |
| `src/libs/og-image/generate.ts` | SSRルート削除に伴い整理する。avatarの `?inline` 読み込みは生成スクリプト側に移る |

## 段階

| 段階 | 内容 | 状態 |
|------|------|------|
| 1 | hash算出基盤の追加 | PR #1962 マージ済み |
| 2 | 生成スクリプトとマニフェスト出力の追加 | 実装中 |
| 3 | blog-contents のワークフローに生成ステップを追加し、全記事の初回生成を行う | 未着手 |
| 4 | 参照側の切り替えとSSRルートの削除 | 未着手 |

段階3の完了時点で全記事の画像がR2に存在する。段階4で参照を切り替えるため、切り替え時に404が発生しない。

## 検証

| 対象 | 方法 |
|------|------|
| ja/enの分離 | 同一slugのja記事とen記事が、それぞれのタイトルの画像を参照すること |
| 内容の同一性 | localeが片方しかない記事で、移行前後のPNGが一致すること |
| 参照の健全性 | マニフェストの全エントリがR2上に存在し200を返すこと |
| 差分生成 | 記事1件の更新で1枚だけ生成されること |

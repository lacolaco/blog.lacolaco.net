---
title: 'Gleam言語に入門する'
slug: 'learning-gleam'
icon: ''
created_time: '2026-01-03T03:48:00.000Z'
last_edited_time: '2026-01-03T03:48:00.000Z'
tags:
  - 'Gleam'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Gleam-2dd3521b014a80fcba47f58bcf8d3238'
features:
  katex: false
  mermaid: false
  tweet: false
---

『達人プログラマー』に習うところでは、毎年新しいプログラミング言語をひとつ学びたい。その流れで去年はV言語を学んだ。

https://www.ohmsha.co.jp/book/9784274226298/

https://vlang.io/

https://www.youtube.com/watch?v=6CHVIzhqNcM

今年はどの言語にしようか考えたところ、Geminiにおすすめされた **Gleam** を採用することにした。たまたま新しく作りたいRSS関連のアプリケーションがあったので、Gleamを使って実装している。

## Gleam

https://gleam.run/

GleamはErlang VM上で動作する静的型付け可能な関数型言語である。

> **主な特徴**
>
> - **強力な型システム**: コンパイル時にエラーを検出し、実行時のクラッシュを防ぎます。「Null」や「例外」が存在しないため、予期せぬエラーに悩まされにくい設計です。
> - **高いパフォーマンスと信頼性**: WhatsAppなどで実績のあるErlang VM上で動くため、数百万のプロセスを扱うような並行処理や分散システムに非常に強いです。
> - **親しみやすい構文**: RustやElmなどに影響を受けたモダンな構文を採用しており、C系言語や他の関数型言語に馴染みがある人には読み書きしやすくなっています。
> - **柔軟な相互運用性**: ErlangやElixirのライブラリをそのまま利用できます。また、**JavaScriptへのコンパイル**も可能なため、WebフロントエンドやNode.js環境でも動作します。
> - **充実したツール**: パッケージマネージャー、フォーマッター、ビルドツールなどが標準で統合されており、開発体験（DX）が優れています。
>
> (by Gemini)

2024年にv1.0を迎えたばかりの新興プログラミング言語ということで、こうした歴史の浅い言語でAgentic Codingがどういう体験になるかということを知ることもできそうだ。

言語構文はそこまで特殊な感じはせず、この言語が初めてのプログラミングというわけじゃなければなんとなく読めると思う。たとえば関数定義は`fn`キーワードだし、`pub fn`キーワードで外部モジュールから参照可能な公開関数になる。ちなみにこのブログでのシンタックスハイライトはGleamに対応してないが、無理やりRustということにしている。構文が似ているのでだいたいうまくいっている。

```rust
// src/router.gleam より

/// GET /health（ドキュメントコメント）
fn health() -> Response {           // プライベート関数
  wisp.ok()
  |> wisp.string_body("OK")
}

/// HTTPリクエストを受け取り、適切なレスポンスを返す
pub fn handle_request(req: Request, config: Config) -> Response {  // 公開関数
  // ...
}
```

## 文字列操作

Gleamは言語構文がけっこう絞られていて、ストイックさを感じる。文字列の結合は`<>`演算子を使うが、よくあるテンプレートリテラルのような仕組みはない。

```rust
Error(FetchError("Invalid URL: " <> url))
Error(FetchError("HTTP " <> string.inspect(status) <> ": " <> url))
```

また、Gleamにはループ構文がない。繰り返し処理は関数の再帰呼び出しで実装する。このあたりも関数型言語っぽい。たとえば文字列からHTMLタグを除去する処理は次のように書ける。`string.pop_grapheme`は文字列の先頭1文字と残りを分割したタプル`#(String, String)`を返す関数。それを`case`文のパターンマッチで再帰処理している。パターンマッチに条件式（ガード）を結合する `Ok(#(_, rest)) if in_tag` がなかなか強力。この言語はパターンマッチを使いこなせると真価が発揮される感じがする。

```rust
pub fn strip_tags(html: String) -> String {
  strip_tags_loop(html, "", False)
}

fn strip_tags_loop(input: String, acc: String, in_tag: Bool) -> String {
  case string.pop_grapheme(input) {
    Error(_) -> acc                                              // 終了条件
    Ok(#("<", rest)) -> strip_tags_loop(rest, acc, True)         // タグ開始
    Ok(#(">", rest)) -> strip_tags_loop(rest, acc, False)        // タグ終了
    Ok(#(_, rest)) if in_tag -> strip_tags_loop(rest, acc, True) // タグ内をスキップ
    Ok(#(char, rest)) -> strip_tags_loop(rest, acc <> char, False) // テキストを蓄積
  }
}
```

## Webアプリケーション

新興の言語ながら、Webアプリケーションを開発するのに便利なHTTPサーバー `mist` とそのうえで使うWebアプリケーションフレームワーク `wisp` が存在するのがありがたい。

https://hexdocs.pm/mist/index.html

https://hexdocs.pm/wisp/

一応サードパーティパッケージではあるがどちらもGleam言語の開発者がガッツリ関与しているのでほぼ公式と考えていいだろう。Go言語でいうところの`net/http`よりはもうちょっと肉付けされてるくらいの薄さだと感じた。ルーターは含まれておらず、大元のハンドラからパターンマッチで個別のエンドポイントに割り振るような実装になる。パターンマッチがあればなんでもできる。

```rust
pub fn handle_request(req: Request, config: Config) -> Response {
  case req.method, wisp.path_segments(req) {
    Get, ["health"] -> health()
    _, ["health"] -> wisp.method_not_allowed([Get])
    Post, ["aggregate"] -> aggregate(config)
    _, ["aggregate"] -> wisp.method_not_allowed([Post])
    _, _ -> wisp.not_found()  // ワイルドカード
  }
}
```

## テスト

他にも言語の特徴はいっぱいあるが、ちょっと使ってみて気に入ったのはユニットテストの実行環境が最初からしっかり入っていることだ。`gleam test` コマンドで簡単に実行できる。`test`ディレクトリ内の`*_test.gleam`ファイルが読み込み対象になり、ファイル内の`_test`で終わる名前の関数がテストケースとして実行される。`assert`も言語に組み込みのキーワードで存在する。テストを書くためのボイラープレートコードがほとんどなくてすばらしい。

```rust
pub fn parse_rss_channel_metadata_test() {
  let assert Ok(feed) = parser.parse(rss_sample)

  assert feed.title == "Example Blog"
  assert feed.link == "https://example.com"
}
```

https://tour.gleam.run/advanced-features/bool-assert/

ブール型を検査するアサーションは一般的だが、Gleamには`let assert`というものがある。これはけっこうすごくて、`=`の右辺の式を評価した結果が左辺のパターンマッチで一致すればその値が変数に束縛され、一致しなければエラーとなる。上記の例ではRSSをパースした結果の`Result`オブジェクトが`Ok`型にマッチすればその後`feed`変数が使えるが、そうでなければエラーでテストが落ちる。Result型じゃなくても任意のパターンマッチが書ける。

https://tour.gleam.run/advanced-features/let-assert/

```rust
// first が取り出せたら束縛、空で取り出せなければエラー
pub fn unsafely_get_first_element(items: List(a)) -> a {
  let assert [first, ..] = items as "List should not be empty"
  first
}
```

言語の至る所に一級市民としてパターンマッチが組み込まれており、なかなか新鮮。いままで使ってなかった脳みそを使う感じがしてとてもよい。

## Claude Codeで書けるのか

だいたい書けている。それなりにインターネット上にドキュメントも充実しており、サードパーティライブラリも見つけてきてくれる。細かい関数名などの間違い（古くて非推奨など）はあるが、基本的には困らなかった。

## 動作環境

今作っているRSSフィードのアグリゲーター（複数RSSフィードを混ぜて1つのフィードにする）は、Google CloudのCloud Runで動かしている。Dockerで動けば動くので、別にGleamじゃなくてもできるが、Gleamはネイティブビルドができるのでなかなか軽量なイメージになる。Gleam公式のDockerイメージが公開されているのも非常にありがたい。

```docker
FROM ghcr.io/gleam-lang/gleam:v1.13.0-erlang-alpine AS builder

WORKDIR /app

COPY gleam.toml manifest.toml ./

# 依存関係をダウンロード
RUN gleam deps download

# ソースコードをコピー
COPY src/ src/

# リリースビルド（escript形式）
# escript: Erlang の実行可能スクリプト形式
# 依存関係を含む単一ファイルが生成される
RUN gleam export erlang-shipment
```

## まとめ

Gleam楽しい。今年一年は使い込んでいこうと思う。


---
title: 'Rust+wasmでSVGを生成したら10倍速くなった'
date: '2022-02-26T03:29:00.000Z'
updated_at: '2022-02-26T08:15:00.000Z'
tags:
  - 'Rust'
  - 'WebAssembly'
  - 'wasm'
  - 'svg'
  - 'Node.js'
  - 'Nx'
  - 'GitHub Actions'
draft: false
source: 'https://www.notion.so/Rust-wasm-SVG-10-48a52b0559eb43a5b9046e66f64550ce'
---

[https://contrib.rocks](https://contrib.rocks) は GitHub の API から取得したコントリビューター情報から SVG 画像を生成している。これまでは SVG.js を使った TypeScript での実装だったが、興味本位で Rust で実装したものを WebAssembly(wasm)として実行するようにしたところ、パフォーマンスが顕著に向上したためそのまま採用することにした。

{{< embed "https://github.com/lacolaco/contributors-img/pull/1089" >}}

Rust も wasm もまともに触ったのは今回がはじめてだったため、実装には洗練する余地が多分にあるだろうが、この記事ではとりあえず作業の記録を書き残す。

## Nx ワークスペースに Rust をセットアップする

まずはじめに、Nx のワークスペース内で Rust の開発環境を整えた。Cargo にもワークスペース機能があり、複数のプロジェクトの依存関係解決を集約できる。

{{< embed "https://doc.rust-jp.rs/book-ja/ch14-03-cargo-workspaces.html" >}}

ドキュメントに従い、ワークスペースのルートディレクトリに `Cargo.toml` を作成して `members` を設定した。そして Nx ワークスペースに `libs/renderer-rust` プロジェクトを作成し、プロジェクトルートにも `Cargo.toml` を作成した。

```plain text
# Cargo.toml
[workspace]
members = [
  "libs/renderer-rust"
]
```

```plain text
# libs/renderer-rust/Cargo.toml
[package]
edition = "2021"
name = "renderer"
version = "0.1.0"
```

その後、パッケージのエントリポイントとなる `libs/renderer-rust/src/lib.rs` を作成し、最低限の環境が整った。

### Nx の `implicitDependencies` に `Cargo.toml` を追加

`Cargo.toml` に変更があれば Nx のキャッシュを破棄するように `nx.json` の `implicitDependencies` を変更した。

```json
{
  "implicitDependencies": {
    "angular.json": "*",
    "package.json": "*",
    "tsconfig.json": "*",
    "tslint.json": "*",
    ".eslintrc.json": "*",
    "nx.json": "*",
    "Cargo.toml": "*"
  }
}
```

### 各種タスクの定義

Rust プロジェクトへの自動テストや Lint などのタスクを Nx で実行できるターゲットとして定義した。今回は `@nrwl/workspace:run-commands` でシェルコマンドを実行した。 `cargo` コマンドは実行したカレントディレクトリを起点にして実行する思想なようで、 `tsc` の `--project` のようなスコーピングの仕組みが見当たらなかったため、 `cwd` オプションでカレントディレクトリを変更した。

```json
  "renderer-rust": {
    "root": "libs/renderer-rust",
    "sourceRoot": "libs/renderer-rust/src",
    "projectType": "library",
    "architect": {
      "lint": {
        "builder": "@nrwl/workspace:run-commands",
        "options": {
          "command": "cargo clippy",
          "cwd": "libs/renderer-rust"
        }
      },
      "test": {
        "builder": "@nrwl/workspace:run-commands",
        "options": {
          "command": "cargo test",
          "cwd": "libs/renderer-rust"
        }
      }
    }
  },
```

### wasm-pack を使ったビルド

今回は Rust プロジェクトを Node.js のプロジェクトから読み込める wasm パッケージにビルドしたいため、wasm-pack を利用した。

{{< embed "https://rustwasm.github.io/wasm-pack/book/" >}}

`wasm-pack` の `build` コマンドは `--out-dir` オプションで出力先ディレクトリを変更できるが、この引数は常にパッケージルートからの相対パスで解決されるようだったため、他のプロジェクトと同じようにワークスペースルートの `dist` ディレクトリ内へ出力させるために一工夫した。

```json

  "build": {
    "builder": "@nrwl/workspace:run-commands",
    "outputs": ["dist/libs/renderer-rust"],
    "options": {
      "command": "wasm-pack build --target nodejs --out-dir ../../dist/libs/renderer-rust",
      "cwd": "libs/renderer-rust"
    },
    "configurations": {
      "production": {}
    }
  }
```

## Rust 実装

今回 Rust で実装した関数は、TypeScript では次のようなシグニチャである。コントリビューターオブジェクトの配列を受け取り、SVG 文字列を返すことを意味している。

```typescript
type Renderer = (contributors: Contributor[]) => Promise<string>;
```

このシグニチャはそのままで、SVG 文字列を生成する内部実装だけを wasm で置換することを目標とした。

### JS から配列を受け取る Rust 関数

コントリビューターオブジェクトの配列を Rust の関数へ渡すには、`Box<[JsValue]>` 型の引数を定義する（この情報にたどり着くのに少し苦労した）。 `JsValue` は `wasm-bindgen` が提供する型で、JS 側から受け取れる任意のオブジェクトに対応する型のようで、このままでは使えない。

{{< embed "https://rustwasm.github.io/docs/wasm-bindgen/reference/types/boxed-jsvalue-slice.html" >}}

{{< embed "https://rustwasm.github.io/wasm-bindgen/api/wasm_bindgen/struct.JsValue.html#" >}}

Rust でも `Contributor` 構造体を定義しておいて、 `JsValue` 型から `Contributor` 型に変換するには `into_serde()` メソッドを使った。

{{< embed "https://rustwasm.github.io/docs/wasm-bindgen/reference/arbitrary-data-with-serde.html" >}}

詳細はよくわかっていないが、 `wasm-bindgen` の `serde-serialize` 機能を有効にすると、 `serde` という別のライブラリを使った JSON と構造体の間のシリアライズ・デシリアライズができるようになるようだ。ドキュメントに従い、次のように `Contributor` 構造体に必要な trait を実装した。

```rust
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
pub struct Contributor {
    pub avatar_url: String,
    pub contributions: i32,
    pub html_url: String,
    pub id: i32,
    pub login: String,
}
```

これで `Box<[JsValue]>` を `[Contributor]` に変換できるようになった。

```rust
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn render(contributors: Box<[JsValue]>) -> String {
    let parsed = contributors
            .iter()
            .map(|item| item.into_serde().unwrap())
            .collect::<Vec<Contributor>>()
            .as_slice();
		//...
}
```

### SVG 文字列の生成

SVG の組み立ては `svg` ライブラリを利用した。

{{< embed "https://docs.rs/svg/latest/svg/" >}}

特に癖のない API だったため SVG 自体の知識があれば難なく使えた。逆にいままで SVG.js が暗黙的に設定していた属性に依存していたことがわかり、その調査に手間取ることになった。

## パフォーマンスのベンチマーク

同じ入力から同等の出力が得られるようになったところで、従来の実装と新しい Rust+wasm 実装で SVG 生成にかかる時間を計測し、パフォーマンスを比較してみた。

計測は同じ引数での関数呼び出しを十分な回数繰り返し、合計時間を回数で割った平均時間を比較することとした。入力の配列の長さによる傾向も知りたかったので、データサイズごとに計測した。

```typescript
async function benchmark_js(times: number, contributors: Contributor[]) {
  performance.mark('js:start');
  for (let index = 0; index < times; index++) {
    await renderer_js(contributors);
  }
  performance.mark('js:stop');
  performance.measure('js', 'js:start', 'js:stop');
}

async function benchmark_rust(times: number, contributors: Contributor[]) {
  performance.mark('rust:start');
  for (let index = 0; index < times; index++) {
    await renderer_rust(contributors);
  }
  performance.mark('rust:stop');
  performance.measure('rust', 'rust:start', 'rust:stop');
}

async function main() {
  console.log('start benchmark');
  const times = 1000;

  async function run(dataSize: number) {
    console.log(`=== data size: ${dataSize} ===`);
    const contributors = new Array(dataSize)
      .fill(null)
      .map((_, i) => createMockContributor({ login: `login${i}` }));
    await benchmark_js(times, contributors);
    await benchmark_rust(times, contributors);
    for (const measure of performance.getEntriesByType('measure')) {
      console.log(
        `${measure.name}: ${(measure.duration / times).toPrecision(2)}ms`,
      );
    }
    performance.clearMarks();
    performance.clearMeasures();
  }

  await run(1);
  await run(2);
  await run(5);
  await run(10);
  await run(20);
  await run(50);
  await run(100);
}

main();
```

その結果、ざっくり比較して Rust+wasm 実装のほうが JS 実装よりも 10 倍近く速いことがわかった。

```plain text
start benchmark
=== data size: 1 ===
js: 0.30ms
rust: 0.017ms
=== data size: 2 ===
js: 0.30ms
rust: 0.023ms
=== data size: 5 ===
js: 0.61ms
rust: 0.052ms
=== data size: 10 ===
js: 1.1ms
rust: 0.094ms
=== data size: 20 ===
js: 2.1ms
rust: 0.18ms
=== data size: 50 ===
js: 5.2ms
rust: 0.48ms
=== data size: 100 ===
js: 10ms
rust: 0.89ms
```

実際のユースケースでは 100 件のデータで生成することはよくあるため、1 回あたり 10ms かかる処理が 1ms 以下になるとなればなかなかの恩恵といえる。

### wasm パッケージをアプリケーションから読み込む

Nx ワークスペースで管理する別のアプリケーションから `wasm-pack` でビルドしたパッケージを読み込むにあたって工夫が必要なことがあった。

`wasm-pack` の Node.js 向けビルドは内部で `__dirname` を使って隣接する `.wasm` ファイルを読み込むようになっているため、webpack などでバンドルするアプリケーションから読み込むときにファイルが見つからなくなる。この問題は `@nrwl/node:build` (最新では `@nrwl/node:webpack` ) の `assets` オプションでアプリケーションの出力ディレクトリへ `.wasm` ファイルをコピーして解決した。

```json
"assets": [
  {
    "input": "dist/libs/renderer-rust",
    "glob": "*.wasm",
    "output": "."
  }
]
```

これは `wasm-pack` のビルドターゲットを `bundle` にすればいいものだが、webpack v5 ではデフォルトで WebAssembly モジュール機能が無効になっている。実験的フラグを有効にするために webpack コンフィグに手を入れる必要があるため、今回は上記の解決方法でよしとした。

## GitHub Actions での CI

ビルドやテスト、デプロイは GitHub Actions で実行しているため、各ジョブで Node.js に加えて Rust の環境を整える必要がある。今回ははじめてローカルアクションの機能を使ってみた。共有のステップ群を簡単に再利用可能なアクションとしてまとめるものだ。

{{< embed "https://docs.github.com/en/actions/creating-actions/creating-a-composite-action" >}}

`.github/actions/setup-rust/action.yml` を次のように作成し、CI/CD の各ワークフローから `uses: ./.github/actions/setup-rust` のように呼び出した。Composite ローカルアクションへの切り出しは非常にシンプルで使いやすかった。

```yaml
name: Setup Rust

runs:
  using: 'composite'
  steps:
    - uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
        override: true
        profile: minimal
        components: clippy, rustfmt
    - run: cargo install wasm-pack
      shell: bash
```

## まとめ

Rust の学習を兼ねて思いつきでやってみたが、思っていた以上の効果が得られて驚いた。JS から Rust+wasm への置き換えで高速化するという話はいろんな場所で聞いていたが、実際に自分の小さなアプリケーションでも再現したのはいい経験になった。

今回は SVG 生成部分だけを置き換えたが、他の処理も今後置き換えを進めてみたい。

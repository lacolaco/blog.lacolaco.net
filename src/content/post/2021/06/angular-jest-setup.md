---
title: 'AngularプロジェクトへJestを導入する'
slug: 'angular-jest-setup'
icon: ''
created_time: '2021-06-13T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Testing'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Jest-1ed8c3e38fee458b81fe67202edc5a1c'
features:
  katex: false
  mermaid: false
  tweet: false
---

## TL;DR

- `npm i -D jest @types/jest jest-preset-angular`
- `rm karma.conf.js src/test.ts`
- `touch jest.config.js src/setup-jest.ts`
- `jest-preset-angular` プリセットを `jest.config.js` から読み込む

```
require('jest-preset-angular/ngcc-jest-processor');

module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
};
```

- `jest-preset-angular/setup-jest` を `src/setup-jest.ts` からインポートする

```
import 'jest-preset-angular/setup-jest';
```

- `tsconfig.spec.json` を修正する

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jest"]
  },
  "files": ["src/setup-jest.ts"],
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

- `npx jest`

## Angular プロジェクトのユニットテスト

Angular CLI で作成したプロジェクトは最初からユニットテストの準備が整っており、`ng test`コマンドで実行できるようになっている。このユニットテストには [Karma](https://github.com/karma-runner/karma) と [Jasmine](https://github.com/jasmine/jasmine) が使われている。Karma/Jasmine によるユニットテスト実行環境はデフォルトで導入されているものではあるが、Angular のテストに必須のツールではない。開発者は自由に他のツールを選択できる。

特に[Jest](https://jestjs.io/)は今 Angular コミュニティで人気を高めているテスティングフレームワークだ。

[https://jestjs.io/](https://jestjs.io/)

導入にあたって必要な設定が少なく、ドキュメンテーションやユーティリティ API、周辺エコシステムがとてもよく育っている点などが高く評価されている。ブラウザを起動してテストを実行する Karma と比較して、Node.js でテストを実行する Jest は実行スピードや並列実行などパフォーマンス面での利点も大きい。

しかし Jest を Angular プロジェクトへはじめて導入するにあたっていくつかの方法があり、それぞれにつまづきやすいポイントがあるため、この記事では導入方法ごとの違いと注意点を簡単にまとめる。

### `jest-preset-angular`

[https://github.com/thymikee/jest-preset-angular](https://github.com/thymikee/jest-preset-angular)

[jest-preset-angular](https://github.com/thymikee/jest-preset-angular)は、Angular プロジェクトを Jest でテストするにあたって必要な設定項目がパッケージ化されたプリセットである。後述するどのツールも内部的にはこのプリセットに依存しており、Angular の Jest 導入にあたって欠かせないピースである。

`jest-preset-angular` は単なる設定プリセットなので、Jest の導入自体は自分でおこなう。まずは必要なパッケージをインストールしよう。

```
$ npm i -D jest @types/jest jest-preset-angular
```

パッケージをインストールしたら、プリセットを読み込むための設定ファイルと、テスト実行時のセットアップコードを作成する。それぞれ次のように作成しよう。

```
$ touch jest.config.js src/setup-jest.ts
```

`jest.config.js` に最低限必要なプリセットの読み込みとセットアップコードの読み込みを記述する。その他の設定項目は必要に応じて自由に加えてよい。 `ngcc-jest-processor` はテスト前に必要な ngcc を自動的に実行するもので、書いておくと安心だ。

```
require('jest-preset-angular/ngcc-jest-processor');

module.exports = {
  preset: 'jest-preset-angular',
  setupFilesAfterEnv: ['<rootDir>/src/setup-jest.ts'],
};
```

テスト実行前に読み込まれる `src/setup-jest.ts` では `jest-preset-angular/setup-jest` をインポートする。これにより `TestBed`の初期化などの準備が整う。

```
import 'jest-preset-angular/setup-jest';
```

最後にテストコードが正しくコンパイル可能になるよう、`tsconfig.spec.json`を修正する。元々は Jasmine の API が使えるよう設定されているため、Jest の型定義ファイルを読み込み、`setup-jest.ts`ファイルをコンパイル対象にする。

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "./out-tsc/spec",
    "types": ["jest"]
  },
  "files": ["src/setup-jest.ts"],
  "include": ["src/**/*.spec.ts", "src/**/*.d.ts"]
}
```

以上で `jest-preset-angular` を使ったテスト環境は準備できた。`npx jest` コマンドでテストを実行できることを確認しよう。`package.json` の `test`スクリプトは `ng test` になっているが、もう `ng test` は実行しないため `jest` コマンドに書き換えておくといいだろう。

Jest の動作が確認できたら不要になった Karma/Jasmine 関連のファイルを削除する。`karma.conf.js`と`test.ts`を削除し、`package.json`から関連するパッケージを削除しよう。

### 注意点

この方法は Angular CLI の `ng test` とは独立に、`jest`コマンドで Angular プロジェクトをテストできるようにするものである。`ng test`は使えなくなるため、そもそも実行できないよう `angular.json` から `test` に関する設定を消しておくのもいいだろう。

### `@angular-builders/jest`

[https://github.com/just-jeb/angular-builders/blob/master/packages/jest/README.md](https://github.com/just-jeb/angular-builders/blob/master/packages/jest/README.md)

[angular-builders/jest](https://github.com/just-jeb/angular-builders/blob/master/packages/jest/README.md)は `jest-preset-angular` を使ったテストを `ng test` コマンド経由で実行できるようにするパッケージだ。Angular CLI のビルダー API と Jest との間の橋渡しをする。

まずは必要なパッケージをインストールしよう。

```
$ npm i -D jest @types/jest @angular-builders/jest
```

導入は途中まで `jest-preset-angular`と全く同じだ。`jest-preset-angular`を導入して `npx jest` コマンドでテストができることを確認したら、最後に `angular.json` を編集して `test`コマンドで使用されるビルダーを差し替える。

```
        "test": {
          "builder": "@angular-builders/jest:run",
          "options": {
            "configPath": "./jest.config.js"
          }
        }
```

これで `ng test` コマンドで Jest のテストが実行される。

### 注意点

README.md を読めばわかるがこのパッケージも導入自体の自動化された支援はほとんどない。まずは`npx jest`コマンドでテストを実行できることを確認してから最後に導入するのがいいだろう。 ところで `ng test` で実行できることに私はそれほど意味を感じていない。Jest コマンドを直接実行するほうがコマンドライン引数を渡しやすいし、どのみち npm スクリプトでラップするため `ng test` で実行することがないからだ。その点で `@angular-builders/jest` はあまりおすすめしていない。

### `jest-schematic`

[briebug/jest-schematic](https://github.com/briebug/jest-schematic)は `ng add` コマンドで Jest を導入できるようにしたパッケージだ。前述の 2 つと違い、導入の自動化にフォーカスしており、`jest-preset-angular`のセットアップが自動的に行われると考えてよい。

このパッケージは便利だが最近はメンテナンスが遅れているようであり、`jest-preset-angular`自体のセットアップも以前よりは簡単になったため必要性も薄れているのが現状だ。

### `@nrwl/jest`

[nrwl/jest](https://github.com/nrwl/nx/blob/master/packages/jest/README.md)は [Nrwl/Nx](https://nx.dev/)で作られた Angular プロジェクトにデフォルトで導入されている Jest 実行用のパッケージである。独立した npm パッケージになっているため Nx のワークスペース以外でも単独で利用することもできる。

しかしそのような使い方のドキュメントは整備されておらず、Jest 関連パッケージのバージョンアップをするために Nx 本体のバージョンアップを待たなければならない状況も起きるため、特に理由がなければ Nx ワークスペース以外で使うのは推奨できない。

## まとめ

これまで Angular CLI や Jest のそれぞれの設定の煩雑さから、それを軽減するためにいろいろな導入方法が生まれてきたが、現在では `jest-preset-angular` のプリセットさえ読み込めれば基本的に他の設定は不要になった。どうしても `ng test` コマンドで実行したければ `@angular-builders/jest`を、そうでないなら `jest-preset-angular` だけを導入し直接 `jest` コマンドを実行するのがいいだろう。

この記事のサンプルコードは GitHub で公開している。

[https://github.com/lacolaco/angular-jest-playground](https://github.com/lacolaco/angular-jest-playground)

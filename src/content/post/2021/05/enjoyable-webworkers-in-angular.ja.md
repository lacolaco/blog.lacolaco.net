---
title: 'Angular: Comlink を使った Web Worker の導入'
slug: 'enjoyable-webworkers-in-angular.ja'
icon: ''
created_time: '2021-05-26T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
tags:
  - 'Angular'
  - 'Web Worker'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Comlink-Web-Worker-1247081c70a74563886a056d3778a33f'
features:
  katex: false
  mermaid: false
  tweet: false
---

[Web Worker](https://developer.mozilla.org/ja/docs/Web/API/Web_Workers_API/Using_web_workers)は Web 開発の重要な要素として注目を集めている。そして[Comlink](https://github.com/GoogleChromeLabs/comlink)は、Web Worker を使った開発を楽しめるように GoogleChrome チームによって作成された JavaScript ライブラリだ。Comlink は Web Worker で定義された API と UI スレッドが簡単に通信できるようにする。

この記事では、Angular CLI で作成した Angular アプリケーションに Comlink を組み込む方法を説明する。Comlink を使うことで、重い処理をメインスレッドから簡単に切り離すことができ、コードを分離することで JavaScript のバンドルを小さくすることができる。

### アプリケーションの準備

[Angular CLI](https://angular.jp/guide/quickstart#install-cli)を使って、サンプルアプリケーションを作成する。この記事で使用する Angular CLI のバージョンは v12 を前提としている。

```
$ ng new angular-comlink-example --defaults
```

アプリケーションのセットアップが終わったあと、 `comlink` パッケージをインストールする。Comlink は TypeScript 型定義も同梱しているため型定義を追加でインストールする必要はない。

```
$ cd angular-comlink-example
$ yarn add comlink # or npm install comlink
```

### Worker モジュールの実装

例として、Markdown テキストを HTML へ変換するアプリケーションを作成する。 まずはじめに`marked`と`@types/marked`の 2 つのパッケージをインストールする。

```
$ yarn add marked && yarn add --dev @types/marked
```

次に、 `ng generate webworker` コマンドを使い、 `worker/markdown.worker.ts` ファイルを作成する。このコマンドは TypeScript ファイルだけでなく、Web Worker 用の `tsconfig.worker.json` も同時に生成し、そのファイルを参照するように `angular.json` ファイルも更新される。

```
$ ng generate webWorker worker/markdown

CREATE tsconfig.worker.json (289 bytes)
CREATE src/app/worker/markdown.worker.ts (157 bytes)
UPDATE angular.json (3204 bytes)
```

生成された `markdown.worker.ts` ファイルの内容はすべて削除し、次のように Markdown テキストを HTML へコンパイルする API を記述する。

```
// worker/markdown.worker.ts
import * as marked from 'marked';

export const api = {
  compileMarkdown(source: string) {
    return new Promise<string>((resolve, reject) => {
      marked(source, (err, result) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(result);
      });
    });
  },
};
```

`compileMmarkdown` 関数をこのワーカーの API として公開するため、`Comlink.expose`関数を呼び出し、`api`オブジェクトを渡す。

```
import * as marked from 'marked';
import { expose } from 'comlink';

export const api = {
  compileMarkdown(source: string) {
    // ...
  },
};

expose(api); // Expose as worker's API
```

ワーカー側の作業はこれで終わりとなる。

### ワーカーの公開 API を呼び出す

続いて、Comlink を通してワーカーの `compileMarkdown`関数を UI スレッド側から呼び出す。 まずは Angular サービスとして `MarkdownService`クラスを作成し、コンポーネントから呼び出し可能な状態にする。

```
$ ng generate service service/markdown
```

`MarkdownService`クラスには引数に Markdown テキストを受け取りコンパイル結果を Promise で返す `compile`メソッドを定義しておく。

```
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  async compile(source: string): Promise<string> {}
}
```

`worker/markdown.worker.ts`を呼び出すため、Comlink をインポートして `wrap`関数でワーカーインスタンスをプロキシする。 ワーカーは`new Worker(new URL('../worker/markdown.worker', import.meta.url)`でインスタンス化される。この記述形式は[webpack の Web Worker サポート](https://webpack.js.org/guides/web-workers/)で定義されたものである。

```
import { wrap } from 'comlink';

async function compileMarkdown(source: string): Promise<string> {
  const worker = wrap<typeof import('../worker/markdown.worker').api>(
    new Worker(new URL('../worker/markdown.worker', import.meta.url)),
  );
  return await worker.compileMarkdown(source);
}
```

ここで `worker` 変数は `Comlink.expose`で公開された関数を持っており、その型も保持されている。

`api`の型を取り出すために、 `typeof import('../worker/markdown.worker).api` を `wrap<T>`のジェネリクスに渡している。この `import` は ES モジュールのインポートではなく TypeScript の型定義だけをインポートしている。そのため TypeScript のコンパイル後には除去され、静的な参照は残らず JavaScript のバンドルを分割できる。

以下は`service/markdown.service.ts`の最終的な例だ。環境が `window.Worker` をサポートしていない場合は、動的 `import()` を使用してメインスレッドでの処理にフォールバックする。この場合でも自動的にコードは分割され、モジュールは遅延読み込みされる。

```
import { Injectable } from '@angular/core';
import { wrap } from 'comlink';

async function compileMarkdown(source: string): Promise<string> {
  if (window.Worker) {
    const worker = wrap<typeof import('../worker/markdown.worker').api>(
      new Worker(new URL('../worker/markdown.worker', import.meta.url)),
    );
    return await worker.compileMarkdown(source);
  } else {
    // Fallback to main thread with dynamic imports
    const worker = await import('../worker/markdown.worker').then((m) => m.api);
    return await worker.compileMarkdown(source);
  }
}

@Injectable({
  providedIn: 'root',
})
export class MarkdownService {
  async compile(source: string): Promise<string> {
    return await compileMarkdown(source);
  }
}
```

### アプリケーションの実行

アプリケーションを完成させよう。ここでは、`AppComponent` を `MarkdownService`を使用し、その結果を表示するように変更する。

```
import { MarkdownService } from './service/markdown.service';
import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `
    <button (click)="compileMarkdown()">compile</button>

    <div>{{ result }}</div>
  `,
})
export class AppComponent {
  result: string = '';

  constructor(private markdown: MarkdownService) {}

  async compileMarkdown() {
    this.result = await this.markdown.compile(`## Hello Comlink`);
  }
}
```

`ng serve` を使ってアプリをサーブし、ブラウザの開発者ツールを開いてみよう。Network タブを開いて“compile”ボタンをクリックすると、メインのバンドルからは分離された JavaScript ファイルがロードされ、Web Worker として実行される。

![image](/images/enjoyable-webworkers-in-angular.ja/0476d21164731efa00df1ffa37c4b731.db5baa426e08a32c.gif)

### まとめ

このように、Comlink と Angular CLI によって、UI スレッドがブロックされることを簡単に防ぐことができる。 また、webpack 5 ベースになった Angular CLI により、Web Worker コードを遅延ロード可能なバンドルとしてビルドすることも簡単になった。 読み込みだけでなく読み込み後の実行パフォーマンスにも課題があるアプリケーションで導入すると効果を発揮するだろう。

サンプルコードの全体は GitHub で確認できる。

[https://github.com/lacolaco/angular-comlink-example](https://github.com/lacolaco/angular-comlink-example)


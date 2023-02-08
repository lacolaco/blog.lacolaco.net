---
title: 'Angular Component Visual Testing with Cypress'
date: '2022-10-08T01:26:00.000Z'
updated_at: '2022-10-08'
tags:
  - 'angular'
  - 'testing'
  - 'cypress'
  - 'visual testing'
  - 'standalone component'
summary: 'Angularコンポーネントの見た目が崩れていないことを確認する画像回帰テストを、できるだけ最小ステップで既存のAngular CLIプロジェクトに導入する手順を紹介する。'
draft: false
source: 'https://www.notion.so/Angular-Component-Visual-Testing-with-Cypress-06291552322a41529379de518e857222'
---

Angular コンポーネントの見た目が崩れていないことを確認する画像回帰テストを、できるだけ最小ステップで既存の Angular CLI プロジェクトに導入する手順を紹介する。

いくつか検討したが、この方法が現状では比較的追加要素が少なく、導入上の困難が少ないと思われる。もっといい方法を知っている人がいたらぜひ Twitter [@laco2net](https://twitter.com/laco2net) などで教えてほしい。

## サンプルレポジトリ

今回の記事の内容が実際に動作するデモレポジトリはこちら

{{< embed "https://github.com/lacolaco/angular-cypress-vistest-demo" >}}

## CLI ワークスペースに Cypress を導入する

この手順は基本的に Cypress の公式ドキュメントに従う。

{{< embed "https://docs.cypress.io/guides/component-testing/quickstart-angular" >}}

まずは、Angular CLI で作成したワークスペースに、Cypress パッケージをインストールする。

```shell
# npm
npm i -D cypress
# yarn
yarn add -D cypress
```

パッケージをインストールしたら、 `cypress` CLI で各種設定の初期化を行う。Cypress の GUI 操作をしていくと必要なファイルが自動で生成される。

```shell
npx cypress open
```

- テスト形式は “Component Testing” を選択する
- フレームワークは “Angular” を選択する（通常は自動検出されている）
- コンフィグファイルはデフォルトのまま生成する

## 画像回帰テスト用のプラグインを追加する

Cypress 単体では画像回帰テストをサポートしていないため、サードパーティのプラグインを導入する必要がある。

{{< embed "https://docs.cypress.io/guides/tooling/visual-testing" >}}

{{< embed "https://docs.cypress.io/plugins/directory#Visual%20Testing" >}}

いくつかプラグインはあるが、比較的新しく作られメンテナンスが活発なものの中で、コンポーネントテストに適合したものとして `@frsource/cypress-plugin-visual-regression-diff` を紹介する。

{{< embed "https://github.com/FRSOURCE/cypress-plugin-visual-regression-diff" >}}

こちらも導入方法は README.md に書かれていることに従うだけでよい。まずは npm パッケージをインストールする。

```shell
# npm
npm i -D @frsource/cypress-plugin-visual-regression-diff
# yarn
yarn add -D @frsource/cypress-plugin-visual-regression-diff
```

次に、Cypress にプラグインを導入する。2 つの作業が必要で、まずは Cypress のテストコードで `cy.matchImage()` コマンドを使用可能にするために、 `cypress/support/component.ts` ファイルに次のインポート文を追加する。

```typescript
// cypress/support/component.ts

import '@frsource/cypress-plugin-visual-regression-diff';
```

次に、ルートディレクトリに追加されている `cypress.config.ts` にもプラグインを導入する。ただし、 `v2.3.1` の時点では `initPlugin` のインポート文で TypeScript の型定義ファイルが見つからないというエラーがエディターに表示されるが、そのままで動作する。気になる場合は `require` に切り替えても動作するし、 `cypress.config.js` に拡張子を切り替えてもよい。

```typescript
import { defineConfig } from 'cypress';
// プラグインの初期化関数をインポートする
import { initPlugin } from '@frsource/cypress-plugin-visual-regression-diff/plugins';

export default defineConfig({
  component: {
    devServer: {
      framework: 'angular',
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.ts',
    setupNodeEvents(on, config) {
      // プラグインを初期化する
      initPlugin(on, config);
    },
  },
});
```

これでプラグインを導入できた。あとはコンポーネントのテストを記述するだけである。

## コンポーネントテストを記述する

今回の例ではライブラリプロジェクト `projects/ui` の中に作成した `MessageComponent` を対象に画像回帰テストを記述する。

```typescript
// message.component.ts
import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'ui-message',
  template: ` <p *ngIf="message">{{ message }}</p> `,
  styles: [
    `
      p {
        color: red;
      }
    `,
  ],
})
export class MessageComponent {
  @Input() message: string = '';
}
```

このコンポーネント実装に対して、同じディレクトリに `message.component.cy.ts` を作成する。 `cy.mount` コマンドを使って Angular コンポーネントをドキュメント上に表示（マウント）できる。第一引数にはコンポーネントクラスか、テンプレート HTML を指定できる。この関数の使い方については Cypress の公式ドキュメントを参考にするとよい。

{{< embed "https://docs.cypress.io/guides/component-testing/mounting-angular#What-is-the-Mount-Function" >}}

次の例では `MessageComponent` の Input である `message` プロパティに文字列を与えた状態でマウントし、 その後に `cy.matchImage()` コマンドによってスクリーンショットを撮っている。

```typescript
// message.component.cy.ts
import { MessageComponent } from './message.component';

describe('MessageComponent', () => {
  it('mounts', () => {
    cy.mount(MessageComponent, {
      componentProperties: {
        message: 'Hello World',
      },
    });
    cy.matchImage();
  });
});
```

`MessageComponent` はスタンドアロンコンポーネントとして作成しているため特別な記述をしていなが、スタンドアロンコンポーネントではない場合には `declarations` や `imports` といったような NgModule 関連のセットアップが必要になるが、今回は割愛する（ `cy.mount` の API と `TestBed` の経験を合わせればおそらく察しが付くはずだ）。

## 画像回帰テストを実行する

それでは実際に画像回帰テストを実行してみよう。 `cypress` CLI の `open` コマンドでインタラクティブな Cypress の GUI を起動する。

```shell
npx cypress open --component
```

テストを実行するブラウザを選択するよう求められるため、任意のものを選ぶ。その後、テスト一覧から実行したい `message.component.cy.ts` を選択する

{{< figure src="/img/angular-component-visual-testing-with-cypress/e5a7a73a-33f1-4a18-9b6c-b5109340831b/Untitled.png" caption="" >}}

初回は比較する対象の画像がないため、スクリーンショットを保存しただけでテストが通ることになる。実行後に `message.component.ts` と同じディレクトリに `__image_snapshots__` ディレクトリが追加され、撮影されたスクリーンショットを確認できるだろう。

{{< figure src="/img/angular-component-visual-testing-with-cypress/f07014ad-0179-4e7a-8977-f890595333c5/Untitled.png" caption="" >}}

では、Cypress を実行したまま、テストを書き換えてみよう。コンポーネントに渡している `message` インプットを違う文字列に変えてみよう。そうするとテストが再実行されるが、画像の差分が出たことでテストが失敗するはずだ。

```typescript
describe('MessageComponent', () => {
  it('mounts', () => {
    cy.mount(MessageComponent, {
      componentProperties: {
        message: 'Hello Angular', // 文字列を変更する
      },
    });
    cy.matchImage();
  });
});
```

{{< figure src="/img/angular-component-visual-testing-with-cypress/996a6475-6635-4258-8a50-2ad57b9c9be6/Untitled.png" caption="" >}}

画像比較の失敗メッセージの中にある “See comparison” リンクをクリックすると、保存されている画像と現在の画像の差分を GUI で確認することができる。うまくエラーにならない場合は、差分のエラースレッショルド設定を厳しくしてみるといいだろう。

```typescript
cy.matchImage({
  maxDiffThreshold: 0.001, // 0.1%の差でエラーになる
});
```

{{< figure src="/img/angular-component-visual-testing-with-cypress/f32aacac-c7af-4508-8038-64acb7a3538e/Untitled.png" caption="" >}}

比較画面で “Update screenshot” ボタンをクリックすると、新しいスクリーンショットを今後のテスト基準にするようアップデートしてくれる。アップデートしたあとテストを再実行すれば、画像の差分がなくなりテストが成功するようになる。

{{< figure src="/img/angular-component-visual-testing-with-cypress/7ed9358a-cdb3-4c62-8b78-604e6df85c47/Untitled.png" caption="" >}}

### コマンドラインでの実行

`cypress run` コマンドを使うと、GUI ではなくコンソール上でコンポーネントテストを実行することができる。CI などでテストを自動実行する場合に使うことになる。

```shell
npx cypress run --component
```

`cypress run` コマンドではデフォルトでヘッドレスブラウザを使ってテストされる。デフォルトの振る舞いはほとんどがカスタマイズ可能なので、コマンドライン引数の詳細なリファレンスは公式ドキュメントを参照してほしい。

{{< embed "https://docs.cypress.io/guides/guides/command-line" >}}

## まとめ

この記事では Angular のコンポーネントをできるだけ少ない手順で画像回帰テストできるようにする方法を紹介した。冒頭にも書いたように、この方法が現状では追加要素が少なく、導入上の困難が少ないと思っているが、もっといい方法を知っている人がいたらぜひ Twitter [@laco2net](https://twitter.com/laco2net) などで教えてほしい。

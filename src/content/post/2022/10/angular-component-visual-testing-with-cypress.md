---
title: 'Angular Component Visual Testing with Cypress'
slug: 'angular-component-visual-testing-with-cypress'
icon: ''
created_time: '2022-10-08T01:26:00.000Z'
last_edited_time: '2022-10-08T00:00:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Testing'
  - 'Visual Testing'
  - 'Cypress'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Component-Visual-Testing-with-Cypress-06291552322a41529379de518e857222'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angularコンポーネントの見た目が崩れていないことを確認する画像回帰テストを、できるだけ最小ステップで既存のAngular CLIプロジェクトに導入する手順を紹介する。

いくつか検討したが、この方法が現状では比較的追加要素が少なく、導入上の困難が少ないと思われる。もっといい方法を知っている人がいたらぜひ Twitter [@laco2net](https://twitter.com/laco2net) などで教えてほしい。

## サンプルレポジトリ

今回の記事の内容が実際に動作するデモレポジトリはこちら

https://github.com/lacolaco/angular-cypress-vistest-demo

## CLIワークスペースにCypressを導入する

この手順は基本的にCypressの公式ドキュメントに従う。

https://docs.cypress.io/guides/component-testing/quickstart-angular

まずは、Angular CLIで作成したワークスペースに、Cypress パッケージをインストールする。

```shell
# npm
npm i -D cypress
# yarn
yarn add -D cypress
```

パッケージをインストールしたら、 `cypress` CLIで各種設定の初期化を行う。CypressのGUI操作をしていくと必要なファイルが自動で生成される。

```shell
npx cypress open
```

- テスト形式は “Component Testing” を選択する
- フレームワークは “Angular” を選択する（通常は自動検出されている）
- コンフィグファイルはデフォルトのまま生成する

## 画像回帰テスト用のプラグインを追加する

Cypress単体では画像回帰テストをサポートしていないため、サードパーティのプラグインを導入する必要がある。

https://docs.cypress.io/guides/tooling/visual-testing

https://docs.cypress.io/plugins/directory#Visual%20Testing

いくつかプラグインはあるが、比較的新しく作られメンテナンスが活発なものの中で、コンポーネントテストに適合したものとして `@frsource/cypress-plugin-visual-regression-diff` を紹介する。

https://github.com/FRSOURCE/cypress-plugin-visual-regression-diff

こちらも導入方法は README.mdに書かれていることに従うだけでよい。まずはnpmパッケージをインストールする。

```shell
# npm
npm i -D @frsource/cypress-plugin-visual-regression-diff
# yarn
yarn add -D @frsource/cypress-plugin-visual-regression-diff
```

次に、Cypressにプラグインを導入する。2つの作業が必要で、まずはCypressのテストコードで `cy.matchImage()` コマンドを使用可能にするために、 `cypress/support/component.ts` ファイルに次のインポート文を追加する。

```ts
// cypress/support/component.ts

import '@frsource/cypress-plugin-visual-regression-diff';
```

次に、ルートディレクトリに追加されている `cypress.config.ts` にもプラグインを導入する。ただし、 `v2.3.1` の時点では `initPlugin` のインポート文でTypeScriptの型定義ファイルが見つからないというエラーがエディターに表示されるが、そのままで動作する。気になる場合は `require` に切り替えても動作するし、 `cypress.config.js` に拡張子を切り替えてもよい。

```ts
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

```ts
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

このコンポーネント実装に対して、同じディレクトリに `message.component.cy.ts` を作成する。 `cy.mount` コマンドを使ってAngularコンポーネントをドキュメント上に表示（マウント）できる。第一引数にはコンポーネントクラスか、テンプレートHTMLを指定できる。この関数の使い方についてはCypressの公式ドキュメントを参考にするとよい。

https://docs.cypress.io/guides/component-testing/mounting-angular#What-is-the-Mount-Function

次の例では `MessageComponent` の Inputである `message` プロパティに文字列を与えた状態でマウントし、 その後に `cy.matchImage()` コマンドによってスクリーンショットを撮っている。

```ts
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

`MessageComponent` はスタンドアロンコンポーネントとして作成しているため特別な記述をしていなが、スタンドアロンコンポーネントではない場合には `declarations` や `imports` といったようなNgModule関連のセットアップが必要になるが、今回は割愛する（ `cy.mount` のAPIと `TestBed` の経験を合わせればおそらく察しが付くはずだ）。

## 画像回帰テストを実行する

それでは実際に画像回帰テストを実行してみよう。 `cypress` CLI の `open` コマンドでインタラクティブなCypressのGUIを起動する。

```shell
npx cypress open --component
```

テストを実行するブラウザを選択するよう求められるため、任意のものを選ぶ。その後、テスト一覧から実行したい `message.component.cy.ts` を選択する

![image](/images/angular-component-visual-testing-with-cypress/Untitled.png)

初回は比較する対象の画像がないため、スクリーンショットを保存しただけでテストが通ることになる。実行後に `message.component.ts` と同じディレクトリに `__image_snapshots__` ディレクトリが追加され、撮影されたスクリーンショットを確認できるだろう。

![image](/images/angular-component-visual-testing-with-cypress/Untitled.png)

では、Cypressを実行したまま、テストを書き換えてみよう。コンポーネントに渡している `message` インプットを違う文字列に変えてみよう。そうするとテストが再実行されるが、画像の差分が出たことでテストが失敗するはずだ。

```ts
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

![image](/images/angular-component-visual-testing-with-cypress/Untitled.png)

画像比較の失敗メッセージの中にある “See comparison” リンクをクリックすると、保存されている画像と現在の画像の差分をGUIで確認することができる。うまくエラーにならない場合は、差分のエラースレッショルド設定を厳しくしてみるといいだろう。

```ts
cy.matchImage({
  maxDiffThreshold: 0.001, // 0.1%の差でエラーになる
});
```

![image](/images/angular-component-visual-testing-with-cypress/Untitled.png)

比較画面で “Update screenshot” ボタンをクリックすると、新しいスクリーンショットを今後のテスト基準にするようアップデートしてくれる。アップデートしたあとテストを再実行すれば、画像の差分がなくなりテストが成功するようになる。

![image](/images/angular-component-visual-testing-with-cypress/Untitled.png)

### コマンドラインでの実行

`cypress run` コマンドを使うと、GUIではなくコンソール上でコンポーネントテストを実行することができる。CIなどでテストを自動実行する場合に使うことになる。

```shell
npx cypress run --component
```

`cypress run` コマンドではデフォルトでヘッドレスブラウザを使ってテストされる。デフォルトの振る舞いはほとんどがカスタマイズ可能なので、コマンドライン引数の詳細なリファレンスは公式ドキュメントを参照してほしい。

https://docs.cypress.io/guides/guides/command-line

## まとめ

この記事ではAngularのコンポーネントをできるだけ少ない手順で画像回帰テストできるようにする方法を紹介した。冒頭にも書いたように、この方法が現状では追加要素が少なく、導入上の困難が少ないと思っているが、もっといい方法を知っている人がいたらぜひ Twitter [@laco2net](https://twitter.com/laco2net) などで教えてほしい。

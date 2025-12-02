---
title: 'AngularアプリケーションでのAssertion in Production'
slug: 'angular-with-assertion-in-production'
icon: ''
created_time: '2024-02-17T13:29:00.000Z'
last_edited_time: '2024-02-17T14:03:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Assertion-in-Production-94d2bdf2cdf742f3b988539639f95d27'
features:
  katex: false
  mermaid: false
  tweet: false
---

これはAngularアプリケーションの開発においても[**表明 (Assertion)**](https://ja.wikipedia.org/wiki/%E8%A1%A8%E6%98%8E_(%E3%83%97%E3%83%AD%E3%82%B0%E3%83%A9%E3%83%9F%E3%83%B3%E3%82%B0))を取り入れてみようという実験である。簡単なサンプルはGitHubで公開しているので、興味があればそちらも見てもらえるといい。

https://github.com/lacolaco/angular-with-assertions-example

## Assertion in Browsers

Node.jsと違い、ブラウザ環境にはランタイム標準の `assert` 関数はないので、自前でどうにかする必要がある。その実装詳細はここではどうでもよいので素朴に実装する。関数は2種類あり、ひとつは `unsafeAssert`で、表明した事前条件が満たされなければ例外を投げる。もうひとつの `safeAssert` はコンソールログでアサーションエラーが表示されるのみで例外は投げない。

```typescript
/**
 * This function is an assert function.
 * If the condition is false, it throws an error with the given message.
 */
function unsafeAssert(condition: boolean, message: string) {
  if (!condition) {
    const error = new Error(message);
    error.name = 'AssertionError';
    throw error;
  }
}

/**
 * This function is a safe version of the assert function.
 * It never throws an error, but instead logs the error message to the console.
 */
function safeAssert(condition: boolean, message: string) {
  console.assert(condition, message);
}
```

## Toggle Assertion Strategy

上記の2つの関数を、実行モードにより切り替えたい。具体的には、ローカルでの開発時やステージング環境などでは例外を投げる `unsafeAssert` を使いたいが、プロダクション環境では `safeAssert` にしたい。

この戦略のトグルを実装するために、Angular v17.2で導入されたAngular CLIの `define` 機能を使ってみよう。 `THROW_ASSERTION_ERROR`というグローバル変数が `true` であるときに`unsafeAssert`を使うようにするセットアップ関数を実装する。

```typescript
/**
 * This function sets up the global `assert` function.
 * If `THROW_ASSERTION_ERROR` is true, it sets the global `assert` function to `unsafeAssert`, which throws an error when the condition is false.
 * Otherwise, it sets the global `assert` function to `safeAssert`, which logs the error message to the console.
 */
export function setupGlobalAssert() {
  if (THROW_ASSERTION_ERROR) {
    window.assert = unsafeAssert;
  } else {
    window.assert = safeAssert;
  }
}
```

このコードが型チェックを通過できるように、 `global.d.ts` のようなファイルで型定義をしておくのも必要だ。

```typescript
// src/global.d.ts
declare const THROW_ASSERTION_ERROR: boolean;
declare var assert: (condition: boolean, message: string) => void;
```

そして`setupGlobalAssert`を`main.ts`で呼び出せば準備完了だ。

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { setupGlobalAssert } from './lib/assert';

setupGlobalAssert();

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err)
);
```

あとは、`angular.json`を開いてビルドオプションのデフォルト設定と `development` のときの切り替えをそれぞれ行うといい。

```typescript
      "architect": {
        "build": {
          "builder": "@angular-devkit/build-angular:application",
          "options": {
            ...
            "define": {
              "THROW_ASSERTION_ERROR": "false"
            }
          },
          "configurations": {
            "production": {...},
            "development": {
              ...
              "define": {
                "THROW_ASSERTION_ERROR": "true"
              }
            }
          },
          "defaultConfiguration": "production"
        },
```

こうすることで、コード中の`THROW_ASSERTION_ERROR`はビルド時に`false`か`true`に置換される。条件分岐のどちらを通るかがビルドのタイミングで決定できるため、Angular CLIはTree Shakingによって使わない方のassert関数をデッドコードとして削除できる。

## Assertion in Production

このように準備を整えると、次のように（この例の条件は適当だが）コンポーネントで気軽に表明ができる。もちろんコンポーネントじゃなくてもアプリケーションのどこででもできる。

```typescript
import { Component } from '@angular/core';

@Component({
  ...
})
export class AppComponent {
  title = 'ng-assertion';

  ngOnInit() {
    assert(this.title === 'ng-assertion', 'Title is not ng-assertion');
  }
}
```

assert関数が十分に軽量であれば、テストコードではなくアプリケーションコードの側にこのような表明を書いていくことで、ユーザーへの悪影響を最小限にして契約による設計を取り入れていけるのではなかろうか。


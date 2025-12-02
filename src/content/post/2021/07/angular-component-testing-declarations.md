---
title: 'Angular Testing: TestBedにはdeclarationsではなくimportsを設定する'
slug: 'angular-component-testing-declarations'
icon: ''
created_time: '2021-07-07T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
tags:
  - 'Angular'
  - 'Testing'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Testing-TestBed-declarations-imports-49b8a62610b540be869b0a39ab002ff9'
features:
  katex: false
  mermaid: false
  tweet: false
---

https://scrapbox.io/lacolaco-engineering/TestBedにはdeclarationsではなくimportsを設定する

---

コンポーネントのテストにおいて、`TestBed.configureTestingModule()` の `declarations` を設定するユースケースはそれほど多くない。

Angular CLI の `ng generate component` コマンドで生成される spec ファイルが次のようなコードをスキャフォールドするため、それをそのまま使わなければならないと勘違いしている開発者も多いが、[スキャフォールドはお手本ではない](https://scrapbox.io/lacolaco-engineering/%E3%82%B9%E3%82%AD%E3%83%A3%E3%83%95%E3%82%A9%E3%83%BC%E3%83%AB%E3%83%89%E3%81%AF%E3%81%8A%E6%89%8B%E6%9C%AC%E3%81%A7%E3%81%AF%E3%81%AA%E3%81%84)。

```
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FooComponent } from './foo.component';

describe('FooComponent', () => {
    let component: FooComponent;
    let fixture: ComponentFixture<FooComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [FooComponent],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(FooComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
```

## TestBed に declarations を設定しない

- TestBed に `declarations` を設定してコンポーネントテストをすると面倒なことがいくつかある
  - 対象コンポーネントの子コンポーネントが解決できない
    - `schemas: [NO_ERRORS_SCHEMA]` で解消されがち
      - テンプレートがコンパイルエラーになっていることに気づかずデプロイ前のビルドで発覚することもしばしば
      - [NO_ERRORS_SCHEMA を安易に使うのをやめたい話 - とんかつ時々あんどーなつ](https://kasaharu.hatenablog.com/entry/20210705/1625492137)
  - コンポーネントのコンストラクタで注入される依存オブジェクトが提供されていない
    - `imports` や `providers` でセットアップする
    - spec ファイル側での `imports` 忘れ
      - アプリケーションコードで新しく実装するたびにするたびにテスト側でも同じモジュールを追加する
      - アプリケーションコードでは不要になったモジュールをテスト側に残り続けることもしばしば
- `TestBed.configureTestingModule()`の目的
  1. テスト対象の依存関係解決
  1. テストダブルのセットアップ

  - テストダブルのセットアップはテストだけの関心なのでそのままで問題ない
- **同じコンポーネントを二度宣言しない**
  - アプリケーション側でそのコンポーネントを `declarations` に追加しているモジュールがすでにあるはず
  - TestBed でその NgModule をインポートすればテスト対象の依存関係解決は達成されるはず
- コンポーネントのテストが同時にその NgModule のテストにもなる
  - 解決されるべき依存関係が解決されないときテストが失敗する

```
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FooComponent } from './foo.component';
import { FooModule } from './foo.module';

describe('FooComponent', () => {
    let component: FooComponent;
    let fixture: ComponentFixture<FooComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FooModule], // 対象のコンポーネントを提供するモジュールをインポートするだけ
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(FooComponent); // FooModuleで宣言されているため生成できる
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
```

### NgModule を分割するモチベーション

- すべてをコンポーネントが `AppModule` で宣言されていると上記のアプローチはとりづらい
  - 対象コンポーネントと関係ない依存オブジェクトが初期化されるオーバーヘッドが無駄
  - `AppModule`にはアプリケーションの初期化に閉じた関心（いわゆる `forRoot()`）が多くあり、ユニットテストで読み込まれるのが不都合な場面もある
- 再利用可能な NgModule を分割しておくことは`AppModule`の肥大化を防ぐだけでなくユニットテストの書きやすさにもつながる

### TestBed に declarations を設定するユースケース

- TestHost を使うテストケース
  - [Angular 日本語ドキュメンテーション - コンポーネントのテストシナリオ](https://angular.jp/guide/testing-components-scenarios#%E3%83%86%E3%82%B9%E3%83%88%E3%83%9B%E3%82%B9%E3%83%88%E5%86%85%E9%83%A8%E3%81%AE%E3%82%B3%E3%83%B3%E3%83%9D%E3%83%BC%E3%83%8D%E3%83%B3%E3%83%88)
    - 対象コンポーネントを直接テストするのではなくテンプレート経由でテスト用のホストコンポーネントを用意する
  - この場合 `declarations` にはテストホストだけがあり、その依存関係を解決するために対象コンポーネントの NgModule を `imports` に追加すればよい
    - テストホストを使っても使わなくても `imports: [FooModule]` は変わらず有用である
  - ディレクティブのテストも基本的にこの形になる

```
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FooDirective } from './foo.directive';
import { FooModule } from './foo.module';

@Component({
    template: `<div appFoo></div>`
})
class TestHostComponent {}

describe('FooDirective', () => {
    let host: TestHostComponent;
    let fixture: ComponentFixture<TestHostComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            declarations: [TestHostComponent], // テストホストの宣言
            imports: [FooModule], // 対象のディレクティブを提供するモジュール
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(TestHostComponent); // FooModuleで宣言されているため生成できる
        host = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(host).toBeTruthy();
    });
});
```


---
title: "Angularとaxiosを使ったHTTP通信"
date: 2018-04-20T08:00:17+09:00
tags: [angular, axios]
---

題して「頼りすぎない Angular」ということで、Angular の層をなるべく*薄く*アプリケーションを作るにはどうすればいいかというのを考えるシリーズです。
Angular 良さそうなんだけどロックインされて捨てにくそう、という人々向けに、コードのモジュール性とフレームワーク非依存性を重視した実装パターンを試行錯誤します。

第一回目は Angular の HttpClient を覚えずに、人気の npm モジュールである [axios](https://github.com/axios/axios) を使って Angular アプリで Ajax する例を紹介します。
axios は TypeScript の型定義を同梱していて、インターセプターなど Angular の HttpClient と同じような機能が揃っています。

## Live Example

今回の完成形はこちらです。

{{< embed "https://stackblitz.com/edit/angular-with-axios" >}}

[Random User Generator](https://randomuser.me/)からユーザー情報の JSON を取得し、画面に表示するアプリケーションです。

## HttpClient

さて今回は Angular 公式の HttpClient モジュールを使わずフレームワーク非依存の axios を使って HttpClient を作ります。
次のようなファイルでアプリケーション用のカスタムインスタンスを生成して export します。
今回は何もしませんが実際はデフォルトのヘッダを追加したりインターセプターを追加したりいろいろすると思います。

```typescript
import axios from "axios";

const instance = axios.create();

export default instance;
```

## UserRepository

次に、作成した HttpClient を使って API 呼び出しを行うためのサービスクラスを作ります。
単純に import して使うだけです

```typescript
import { Injectable } from "@angular/core";
import httpClient from "../infrastructure/http-client";

@Injectable()
export class UserRepository {
  async random() {
    const { data } = await httpClient.get("https://randomuser.me/api/");
    const {
      results: [user]
    } = data;
    return user;
  }
}
```

作成したサービスクラスを AppModule に登録します。

```typescript
import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";

import { AppComponent } from "./app.component";
import { UserRepository } from "./repository/user";

@NgModule({
  imports: [BrowserModule],
  declarations: [AppComponent],
  bootstrap: [AppComponent],
  providers: [UserRepository]
})
export class AppModule {}
```

## AppComponent

最後にコンポーネントからサービスを利用します。ここは Angular の DI を使います。

```typescript
import { Component } from "@angular/core";
import { UserRepository } from "./repository/user";

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  user: User | null = null;

  constructor(private userRepo: UserRepository) {}

  ngOnInit() {
    this.fetchUser();
  }

  async changeUser() {
    this.user = null;
    await this.fetchUser();
  }

  private async fetchUser() {
    this.user = await this.userRepo.random();
  }
}
```

テンプレートでは名前と写真を表示して、ボタンを押すと`changeUser()`メソッドをトリガーするようにしています。これで完成です。

```html
<h2>Angular with axios</h2>

<ng-container *ngIf="user as user">
  <h2>{{ user.name.first + ' ' + user.name.last | titlecase }}</h2>
  <img src="{{user.picture.large}}" />
</ng-container>
<button (click)="changeUser()">Change User</button>
```

## テストと DI

サービスクラスの`UserRepository`では直接`httpClient`を import して参照しましたが、`AppComponent`では DI 経由で`UserRepository`を参照しました。
この違いは、ユニットテストをどう書くかという観点で分かれています。

axios は[moxios](https://github.com/axios/moxios)というパッケージを使うことで簡単に axios のインスタンスをモック化できます。
そのため、`httpClient`の初期化のテストにおいても、`UserRepositry`の振る舞いのテストにおいても、DI は必要ありません。

しかし`AppComponent`から`UserRepository`を直接参照すると、簡単にはモックできません。
なのでテスト時に`UserRepository`のモックを提供できるように DI 経由で参照しています。

## 利点・欠点

### 利点

- axios は有名で人気なライブラリなので学習しやすい
- HttpClient 部分は Angular じゃなくても使える

### 欠点

- RxJS の恩恵を受けられない
  - 遅延実行
  - 複数値の返却

RxJS の恩恵については、`UserRepository`の層で`fromPromise`関数などを使って`Observable`を返すようにすれば少しだけ解決します。
しかし Flux 的な設計をするとなると Observable なのはストアだけで良くて、fetch 自体は単発で終わるほうが扱いやすいので特に欠点ではない気もしています。

## まとめ

- Angular の HttpClient は必須ではない
- axios のようなライブラリを使ってフレームワーク非依存の独自 HttpClient を作れる
- DI するかどうかはテストしやすさを考える

次回は未定です。

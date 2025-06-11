---
title: 'Firebase App HostingでAngularのSSRを試す'
slug: 'firebase-app-hosting-angular-ssr-tryout'
icon: ''
created_time: '2024-05-15T07:52:00.000Z'
last_edited_time: '2024-05-15T08:18:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Firebase'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Firebase-App-Hosting-Angular-SSR-a2c74ee085a2495090f5f4a968192faf'
features:
  katex: false
  mermaid: false
  tweet: false
---

Google I/O 2024で発表されたFirebaseの新機能 “App Hosting” をさっそく試してみた。AngularとNext.jsをサポートした、SSR（サーバーサイドレンダリング）重視のWebアプリケーションホスティング環境ということである。

https://firebase.google.com/docs/app-hosting

実際に試してみると何にも特別なことをしないままGoogle Cloudのインフラ上でサーバーサイドレンダリングされるホスティング環境が手に入ってしまったので、今までの苦労はなんだったんだという感じである。ぜひ試してみてほしい。

## Angular アプリケーションの準備

App HostingへのデプロイはGitHubレポジトリとの連携を前提としている。なのでまずはAngularアプリケーションのレポジトリを作成する。

`ng new` コマンドでAngular v17.x系のプロジェクトを作成し、作成時のプロンプトで忘れずにSSRを有効にするか、`—ssr` フラグを付けておく。これがないとただのSPAのホスティングと変わらない。

そのままでもデプロイはできるがSSRされていることの確認が困難なので、アプリケーションに動的な部分を追加する。AngularのSSRではサーバーサイドで実行されたときに組み込みの`HttpClient`を介してフェッチされたレスポンスがキャッシュされてクライアントサイドに渡され、それにより同じリクエストを再送することを回避できる機能がある。これを利用しよう。雑にAppComponentで外部APIを呼び出した結果を表示するように変更する。

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideClientHydration(),
    provideHttpClient(withFetch()), // <--- HttpClientの追加
  ],
};

// app.component.ts
import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <h1>Welcome to {{ title }}!</h1>
    <p>User: {{ user().name }}</p>
  `,
})
export class AppComponent {
  title = 'apphosting-sandbox';
  user = signal({ name: 'John Doe' });
  #httpClient = inject(HttpClient);

  ngOnInit() {
    this.#httpClient.get<{ name: string }>('https://jsonplaceholder.typicode.com/users/1').subscribe((user) => {
      this.user.set(user);
    });
  }
}
```

この状態でmainブランチにプッシュしておけば準備完了である。

## App Hostingのセットアップ

任意のFirebaseプロジェクトを作成した後、メニューの「構築」カテゴリにあるApp Hostingを選択し、「始める」をクリックする。

<figure>
  <img src="/images/firebase-app-hosting-angular-ssr-tryout/Untitled.png" alt="App Hosting画面の初期状態にある「始める」ボタンをクリックする">
  <figcaption>App Hosting画面の初期状態にある「始める」ボタンをクリックする</figcaption>
</figure>

プロジェクトに最初のApp Hosting環境を作成する場合、まずはGitHubとの連携などやることがあるが、画面のウィザードに従えば何も難しいことはない。

<figure>
  <img src="/images/firebase-app-hosting-angular-ssr-tryout/a99d10a4-d385-46c0-b4ea-730a733b0263.png" alt="GitHubアカウントを連携してレポジトリを選択する">
  <figcaption>GitHubアカウントを連携してレポジトリを選択する</figcaption>
</figure>

<figure>
  <img src="/images/firebase-app-hosting-angular-ssr-tryout/074174fa-3246-4b5b-b747-49c3c636aa43.png" alt="デプロイの設定を行う。今回はライブブランチ（本番環境に対応するブランチ）をmainに設定する">
  <figcaption>デプロイの設定を行う。今回はライブブランチ（本番環境に対応するブランチ）をmainに設定する</figcaption>
</figure>

<figure>
  <img src="/images/firebase-app-hosting-angular-ssr-tryout/80cd3956-ca40-4c08-8234-9ed03c9262be.png" alt="（おそらく）プロジェクト内でユニークなIDを設定する。自動生成されるホスティング用URLのドメインに含められる">
  <figcaption>（おそらく）プロジェクト内でユニークなIDを設定する。自動生成されるホスティング用URLのドメインに含められる</figcaption>
</figure>

ボタンを押していき、「終了してデプロイ」を押せば完了となる。mainブランチのHEADのソースコードからアプリケーションが自動的にビルドされ、デプロイされる。

![image](/images/firebase-app-hosting-angular-ssr-tryout/Untitled.png)

「ドメイン」に表示されているURLを開くと、自動的に構築されたCloud Run上でSSRされたHTMLと、必要な静的ファイルが配信され、アプリケーションが動作することを確認できる。ブラウザの開発者ツールでネットワーク情報を確認すれば、クライアントサイドで外部APIへのリクエストが発生しておらず、画面に表示されたユーザー名はSSRで埋め込まれたものだとわかる。

![image](/images/firebase-app-hosting-angular-ssr-tryout/Untitled.png)

というわけで、アプリケーションコードには何も手を加えず、それどころか設定ファイルの1行も触ることなくAngularのSSRホスティング環境が手に入る時代になった。まだパブリックベータだが、プロダクションではないホビーユースには十分な機能があるように見える。

ちなみにFirebase App Hostingを使うのにAngularアプリケーションにAngularFireやFirebaseのランタイムSDKを導入する必要はない。もちろんFirebaseの機能を組み込みたいなら使えるが、App Hostingへのデプロイはそれらに依存してない。

いままでFirebase HostingとFirebase Cloud Functionsを組み合わせてあれこれ苦労しないと実用的なSSR環境を構築するのが難しかったが、完全に過去のものとなった。Firebase公式によれば、従来のHostingからは「卒業」してほしいとのことだ。ぜひともそうさせてもらおう。

<figure>
  <img src="/images/firebase-app-hosting-angular-ssr-tryout/Untitled.png" alt="“If you're already using the frameworks experiment in the Firebase CLI, we recommend "graduating" to App Hosting.”">
  <figcaption>“If you're already using the frameworks experiment in the Firebase CLI, we recommend "graduating" to App Hosting.”</figcaption>
</figure>

> For developers creating a full-stack Angular app, we strongly recommend Firebase App Hosting. If you're already using the frameworks experiment in the Firebase CLI, we recommend "graduating" to App Hosting. With App Hosting, you'll have a unified solution to manage everything from CDN to server-side rendering, along with improved GitHub integration.

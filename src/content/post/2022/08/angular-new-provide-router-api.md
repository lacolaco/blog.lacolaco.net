---
title: 'Angular: provideRouter によるルーティング設定 (v14.2)'
slug: 'angular-new-provide-router-api'
icon: ''
created_time: '2022-08-29T12:18:00.000Z'
last_edited_time: '2022-08-29T00:00:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-provideRouter-v14-2-df74379c5f804dff9fb816ae978af4a8'
features:
  katex: false
  mermaid: false
  tweet: true
---

Angular v14.2で追加された Routerパッケージの `provideRouter` APIは、 `RouterModule.forRoot` を使わずにルーティング設定を行うことができる。このAPIはアプリケーションがスタンドアロンコンポーネントを使っていなくても使用できる。

https://github.com/angular/angular/pull/47010

https://twitter.com/angular/status/1563213226627608577

というわけで、 `NgModule` ベースの従来からのアプリケーションとスタンドアロンAPIベースのアプリケーションの両方で、この新しい `provideRouter` APIの使用例を紹介する。

## NgModuleベースのアプリケーションでの使用例

従来からの `NgModule` ベースのアプリケーションでは、これまで `RouterModule.forRoot` を `imports` 配列に追加していたコードを、 `provideRouter` の戻り値を `providers` 配列に追加するように書き換えればよい。

ただし、 `routerLink` や `<router-outlet>` などのディレクティブをコンポーネントのHTMLテンプレートで使うにはそれらをエクスポートしている `RouterModule` が必要なので、 `imports` 配列には素の `RouterModule` が残るだろう。

```ts
import { BrowserModule } from '@angular/platform-browser';
import { provideRouter, RouterModule } from '@angular/router';
import { AppComponent } from './app.component';
import { routes } from './app.routing';
import { Page1Component } from './page1.component';
import { Page2Component } from './page2.component';

@NgModule({
  // import RouterModule for templates (router directives)
  imports: [BrowserModule, RouterModule],
  // provide Router with routes
  providers: [provideRouter(routes)],
  declarations: [AppComponent, Page1Component, Page2Component],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

https://stackblitz.com/edit/angular-ivy-mmfp8p?ctl=1&embed=1&file=src/app/app.module.ts

## スタンドアロンAPIベースのアプリケーションでの使用例

`NgModule` を持たないスタンドアロンAPIベースのアプリケーションでは、 `bootstrapApplication` 関数のオプションで `providers` 配列に `provideRouter` の戻り値を渡せばよい。

```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routing';

bootstrapApplication(AppComponent, {
  // provide Router with routes
  providers: [provideRouter(routes)],
});
```

https://stackblitz.com/edit/angular-ivy-5obw68?ctl=1&embed=1&file=src/main.ts

## RouterFeaturesによるオプション設定

これまで `RouterModule.forRoot` の第2引数で設定していたオプションは、 `provideRouter` では可変長配列になっている第2引数以降に `RouterFeature` 型のオブジェクトを渡して設定する。 `RouterFeature` オブジェクトの生成は `withXXX` という命名の関数が用意されており、その戻り値を渡す。

```ts
import { provideRouter, withDebugTracing, withRouterConfig } from '@angular/router';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(
      appRoutes,
      withDebugTracing(),
      withRouterConfig({
        paramsInheritanceStrategy: 'always',
      }),
    ),
  ],
});
```

これまでは単一のオブジェクトにすべてのオプションを指定していたが、新しいAPIでは個別のオプションごとに独立した `RouterFeature` として定義される。 `RouterFeature` を返す関数の一覧は [APIレファレンス](https://angular.io/api/router#functions)から確認できる。

## 遅延ロード用の `provideRoutes`

`provideRouter` は `RouterModule.forRoot` に対応するAPIなので、当然 `RouterModule.forChild` に対応するものもある。それが `provideRoutes` APIだ。

遅延読み込みさせる子モジュールの `providers` 配列に `provideRoutes` 関数の戻り値を渡すことで `RouterModule.forChild` と同等の設定ができる。

```ts
@NgModule({
  providers: [
    provideRoutes([
      {
        path: '',
        pathMatch: 'full',
        component: PageLazyComponent,
      },
    ]),
  ],
  declarations: [PageLazyComponent],
})
export class LazyLoadedModule {}
```

あとはこのモジュールを `loadChildren` に指定するといい。

```ts
export const routes: Route[] = [
  {
    path: 'lazy',
    loadChildren: () => import('./lazy/lazy.module').then((m) => m.LazyLoadedModule),
  },
  // ...
];
```

ちなみに、スタンドアロンAPIベースであればそもそも `Route[]` 型のオブジェクトを `loadChildren` に渡せばいいため、 `provideRoutes` APIは必要ない。

```ts
// lazy/lazy.routing.ts
export const routes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    component: PageLazyComponent,
  },
];

// app.routing.ts
export const routes: Route[] = [
  {
    path: 'lazy',
    loadChildren: () => import('./lazy/lazy.routing').then((m) => m.routes),
  },
  // ...
];
```

## 既存アプリを `provideRouter` に置き換えるべきか？

RouterやHttpClient、Commonなど、Angularのビルトインパッケージは脱 `NgModule` の対応が着々と進められているが、基本的にスタンドアロンAPIは `NgModule` と互換性が保たれているため、既存アプリがスタンドアロンAPIベースへ置き換えることを急ぐ必要はない。

ただし、 `provideRouter` に関してはスタンドアロンAPIベースであるなしにかかわらず `RouterModule.forRoot` を置き換えられるAPIとして提供されている。つまり、現在は同じ用途のAPIが2つ存在しており、これはAngularのフレームワークとしての基本的な原則に反している。これが許されているのは `provideRouter` APIがまだデベロッパープレビュー版だからだろう。

したがって、 `provideRouter` が安定APIとしてリリースされるときには、おそらく `RouterModule.forRoot` が代わりに非推奨となることが予想される（ `RouterModule` 自体はディレクティブのエクスポートのために残されるだろう）。置き換えを急ぐ必要はないが、1〜2年以内にあるかもしれない変更として意識しておくと驚かずに済むのではなかろうか。

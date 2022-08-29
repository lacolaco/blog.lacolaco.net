---
title: 'Angular: provideRouter によるルーティング設定 (v14.2)'
date: '2022-08-29T12:18:00.000Z'
updated_at: '2022-08-29T14:25:00.000Z'
tags:
  - 'angular'
  - 'router'
  - 'standalone component'
draft: false
source: 'https://www.notion.so/Angular-provideRouter-v14-2-df74379c5f804dff9fb816ae978af4a8'
---

Angular v14.2 で追加された Router パッケージの `provideRouter` API は、 `RouterModule.forRoot` を使わずにルーティング設定を行うことができる。この API はアプリケーションがスタンドアロンコンポーネントを使っていなくても使用できる。

{{< embed "https://github.com/angular/angular/pull/47010" >}}

{{< tweet "1563213226627608577" >}}

というわけで、 `NgModule` ベースの従来からのアプリケーションとスタンドアロン API ベースのアプリケーションの両方で、この新しい `provideRouter` API の使用例を紹介する。

## NgModule ベースのアプリケーションでの使用例

従来からの `NgModule` ベースのアプリケーションでは、これまで `RouterModule.forRoot` を `imports` 配列に追加していたコードを、 `provideRouter` の戻り値を `providers` 配列に追加するように書き換えればよい。

ただし、 `routerLink` や `<router-outlet>` などのディレクティブをコンポーネントの HTML テンプレートで使うにはそれらをエクスポートしている `RouterModule` が必要なので、 `imports` 配列には素の `RouterModule` が残るだろう。

```typescript
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

{{< stackblitz "https://stackblitz.com/edit/angular-ivy-mmfp8p?embed=1&file=src/app/app.module.ts" >}}

## スタンドアロン API ベースのアプリケーションでの使用例

`NgModule` を持たないスタンドアロン API ベースのアプリケーションでは、 `bootstrapApplication` 関数のオプションで `providers` 配列に `provideRouter` の戻り値を渡せばよい。

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routing';

bootstrapApplication(AppComponent, {
  // provide Router with routes
  providers: [provideRouter(routes)],
});
```

{{< stackblitz "https://stackblitz.com/edit/angular-ivy-5obw68?embed=1&file=src/main.ts" >}}

## RouterFeatures によるオプション設定

これまで `RouterModule.forRoot` の第 2 引数で設定していたオプションは、 `provideRouter` では可変長配列になっている第 2 引数以降に `RouterFeature` 型のオブジェクトを渡して設定する。 `RouterFeature` オブジェクトの生成は `withXXX` という命名の関数が用意されており、その戻り値を渡す。

```typescript
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

これまでは単一のオブジェクトにすべてのオプションを指定していたが、新しい API では個別のオプションごとに独立した `RouterFeature` として定義される。 `RouterFeature` を返す関数の一覧は [API レファレンス](https://angular.io/api/router#functions)から確認できる。

## 遅延ロード用の `provideRoutes`

`provideRouter` は `RouterModule.forRoot` に対応する API なので、当然 `RouterModule.forChild` に対応するものもある。それが `provideRoutes` API だ。

遅延読み込みさせる子モジュールの `providers` 配列に `provideRoutes` 関数の戻り値を渡すことで `RouterModule.forChild` と同等の設定ができる。

```typescript
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

```typescript
export const routes: Route[] = [
  {
    path: 'lazy',
    loadChildren: () => import('./lazy/lazy.module').then((m) => m.LazyLoadedModule),
  },
  // ...
];
```

ちなみに、スタンドアロン API ベースであればそもそも `Route[]` 型のオブジェクトを `loadChildren` に渡せばいいため、 `provideRoutes` API は必要ない。

```typescript
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

Router や HttpClient、Common など、Angular のビルトインパッケージは脱 `NgModule` の対応が着々と進められているが、基本的にスタンドアロン API は `NgModule` と互換性が保たれているため、既存アプリがスタンドアロン API ベースへ置き換えることを急ぐ必要はない。

ただし、 `provideRouter` に関してはスタンドアロン API ベースであるなしにかかわらず `RouterModule.forRoot` を置き換えられる API として提供されている。つまり、現在は同じ用途の API が 2 つ存在しており、これは Angular のフレームワークとしての基本的な原則に反している。これが許されているのは `provideRouter` API がまだデベロッパープレビュー版だからだろう。

したがって、 `provideRouter` が安定 API としてリリースされるときには、おそらく `RouterModule.forRoot` が代わりに非推奨となることが予想される（ `RouterModule` 自体はディレクティブのエクスポートのために残されるだろう）。置き換えを急ぐ必要はないが、1〜2 年以内にあるかもしれない変更として意識しておくと驚かずに済むのではなかろうか。

---
title: 'Angular: Provider Function Pattern'
date: '2022-10-16T07:08:00.000Z'
updated_at: '2022-10-16'
tags:
  - 'angular'
  - 'tech'
  - 'dependency injection'
  - 'standalone component'
summary: 'Angular v14から導入された Standalone API に適応する形で、標準ライブラリやサードパーティライブラリが提供するAPIにある共通のパターンが表れ始めた。この記事では、私が “Provider Function” と呼んでいるその新しいパターンについて解説する。'
draft: false
source: 'https://www.notion.so/Angular-Provider-Function-Pattern-613bc5ddc46c4c0a8e30b0f0dc1b8d4d'
---

Angular v14 から導入された Standalone API に適応する形で、標準ライブラリやサードパーティライブラリが提供する API にある共通のパターンが表れ始めた。この記事では、私が **“Provider Function”** と呼んでいるその新しいパターンについて解説する。

## Provider Function パターン

Provider Function パターンとは、Standalone 以前に広がっていた `NgModule` の `forRoot()` パターンに対応する形で、 `NgModule` を使わずに DI プロバイダーをセットアップするための API パターンである。おそらく具体的な例を見たほうがパターンを理解しやすいだろうから、いくつか紹介する。

1 つ目は Router パッケージが提供する `provideRouter()`API だ。この API については以前記事を書いたので、詳細はそちらを参照してほしい。

{{< embed "https://blog.lacolaco.net/2022/08/angular-new-provide-router-api/" >}}

以前は `RouterModule.forRoot()` でセットアップしていた `Router` サービスを、 `provideRouter()` 関数でセットアップするようになった。

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

2 つ目は `@angular/platform-browser` パッケージが提供する `provideAnimations()` API だ。以前は `BrowserAnimationsModule` をインポートしていたが、代わりにこの関数の戻り値を `providers` 配列に追加するようになっている。

[https://angular.io/api/platform-browser/animations/provideAnimations](https://angular.io/api/platform-browser/animations/provideAnimations)

```typescript
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideAnimations } from '@angular/platform-browser/animations';

bootstrapApplication(AppComponent, {
  providers: [provideAnimations()],
});
```

3 つ目は、v15 より `@angular/common/http` パッケージから提供される予定の `provideHttpClient()` API だ。もう説明不要だと思うが、 `HttpClientModule` の代わりに `HttpClient` を利用可能にする。

[https://next.angular.io/api/common/http/provideHttpClient](https://next.angular.io/api/common/http/provideHttpClient)

最後に紹介するのはサードパーティライブラリの NgRx が提供する `provideStore()` API だ。

[NgRx \- provideStore](https://ngrx.io/api/store/provideStore)

`provideStore()` 関数は従来の `StoreModule.forRoot()` に対応したものであり、 `Store` サービスを利用可能にする。

```typescript
bootstrapApplication(AppComponent, {
  providers: [provideStore()],
});
```

これらの API に共通するパターンの特徴が見えてきただろうか？

## プロバイダー宣言と動的なパラメータ

Angular の DI システムにおいて、 `providers` 配列に追加するオブジェクトは **プロバイダーオブジェクト**である。これは Standalone API に関係なくいままでもずっとそうだった。

[https://angular.io/api/core/Provider](https://angular.io/api/core/Provider)

**プロバイダーオブジェクト**は、依存性の注入の中で、あるトークンに対応するインスタンスを提供 (provide）するような役割を指す。そのインスタンスの生成方法の違いによって、プロバイダーはクラスプロバイダー・ファクトリープロバイダー・値プロバイダーなど、いくつかのタイプに分けられる。

[Angular 日本語ドキュメンテーション - 依存性プロバイダーの設定](https://angular.jp/guide/dependency-injection-providers)

多くの Angular ライブラリが依存性の注入を介して提供する API は、シングルトンである場合が多い。その場合は `providedIn: 'root'` オプションによって、自動的にプロバイダーがセットアップされる。しかしこのままでは、アプリケーションや実行環境ごとに異なる初期パラメータを渡すことができない。

```typescript
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class HeroService {}
```

サービスに動的なパラメータを渡したい場合には 2 つの手段がある。ひとつはそのパラメータも DI で解決する方法、もうひとつはファクトリープロバイダーを使って開発者自身が `new` する方法だ。

前者の方法では、パラメータに専用の**DI トークン**を発行し、値プロバイダーを使ってパラメータを提供する。サービス側では、そのトークンをキーにしてパラメータを注入することができる。

```typescript
// library side
import { Injectable, InjectionToken } from '@angular/core';

export type HeroServiceParams = ...;

export const HERO_SERVICE_PARAMS = new InjectionToken<HeroServiceParams>('hero params');

@Injectable({
  providedIn: 'root',
})
export class HeroService {
  constructor(@Inject(HERO_SERVICE_PARAMS) params: HeroServiceParams) {}
}

// application side
bootstrapApplication(AppComponent, {
  providers: [
    { provide: HERO_SERVICE_PARAMS, useValue: { ... } },
  ],
});
```

後者のファクトリープロバイダーを使う方法は単純で、 `providedIn: 'root'` をやめてしまい、 `useFactory` でインスタンスを生成する。コンストラクタを開発者自身が呼び出すため、DI トークンは必要ない。ただし、この場合はサービスクラスのコンストラクタが要求するすべてのパラメータを利用側が渡さなければならないため、アプリケーション側の負担が大きい。

```typescript
// library side
import { Injectable } from '@angular/core';

export type HeroServiceParams = ...;

@Injectable()
export class HeroService {
  constructor(params: HeroServiceParams) {}
}

// application side
bootstrapApplication(AppComponent, {
  providers: [
    { provide: HeroService, useFactory: () => new HeroService({...}) },
  ],
});
```

どちらの方法にしても、ライブラリが公開するサービスクラスや DI トークンに対して、ライブラリを利用するアプリケーション側でプロバイダーを宣言することになっているのだが、ここで問題になるのはライブラリが要求する型に合致したインスタンスが正しく提供される保証がないことだ。

インターフェースと実装を分離できるのが依存性の注入の利点ではあるが、ライブラリとしてはどんなオブジェクトが提供されるかわからないため、アプリケーション側でプロバイダーが宣言されるようなパラメータについては、楽観的に正常系だけを考慮するか、防御的にアサーションするかの選択を迫られることになる。

この問題を多くの場面でこれまで解決していたのが、NgModule の `forRoot()` パターンである。これは「**プロバイダーオブジェクトを返す静的メソッド**」をライブラリの NgModule が提供することで、静的メソッドの引数として動的なパラメータを受け取りながら、プロバイダーの宣言はライブラリ側に閉じることができるパターンになっている。このとき `forRoot()` メソッドの戻り値は `ModuleWithProviders` 型が使われる。NgModule のインポートとして機能しつつ、プロバイダーも提供することができる型だ。

[Angular 日本語ドキュメンテーション - for Root()の仕組み](https://angular.jp/guide/singleton-services#forroot%E3%81%AE%E4%BB%95%E7%B5%84%E3%81%BF)

ちなみに `forRoot()` という名前は、シングルトンにするためにルートモジュールで一回だけ提供してほしいことを示す慣例的なものであり、それ以上の特別な意味はない。

```typescript
// library side
import { Injectable, InjectionToken, ModuleWithProviders } from '@angular/core';

export type HeroServiceParams = ...;

//// internal
const HERO_SERVICE_PARAMS = new InjectionToken<HeroServiceParams>('hero init');

@Injectable()
export class HeroService {
  constructor(@Inject(HERO_SERVICE_PARAMS) params: HeroServiceParams) {}
}

@NgModule({})
export class HeroModule {
  static forRoot(params: HeroServiceParams): ModuleWithProviders {
    return {
      ngModule: HeroModule,
      providers: [
        HeroService,
        { provide: HERO_SERVICE_PARAMS, useValue: params },
      ],
    }
　　　　}
}

// application side
@NgModule({
  imports: [ HeroModule.forRoot({...}) ],
})
export class AppModule {}
```

このような経緯で、 `RouterModule` をはじめとしたさまざまなライブラリが提供する `forRoot()` のような静的メソッドのパターンが広まっていた。だが Standalone API によって NgModule がオプショナルになったことで、新しい API が必要になった。そこで生まれてきたのが **Provider Function** というパターン だ。

## Provider Function

**Provider Function** とはその名の通り、プロバイダーを返す関数である。つまり `forRoot()` 静的メソッドがやっていたことと同じである。違っているのは、その戻り値が NgModule としても機能する必要がなくなり、純粋にプロバイダーだけを返せばよくなったことである。

Provider Function は慣例的に `provideXXX()` という命名規則に則り、 `provide` というプレフィックスを持つ。また、 `XXX` の部分にはその Provider Function によって提供されることになるサービスなどの名前が入る。 `Router` サービスに対応する `provideRouter()` といった形だ。

ちなみに NgModule でも Standalone でも、 `providers` 配列の要素には プロバイダーの**配列**を渡してもよい。プロバイダーの配列を渡した場合は自動的に flatten される。

```typescript
// library side
import { Injectable, InjectionToken, Provider } from '@angular/core';

export type HeroServiceParams = ...;

//// internal
const HERO_SERVICE_PARAMS = new InjectionToken<HeroServiceParams>('hero init');

@Injectable()
export class HeroService {
  constructor(@Inject(HERO_SERVICE_PARAMS) params: HeroServiceParams) {}
}

export function provideHeroService(params: HeroServiceParams): Provider[] {
  return [
    HeroService,
    { provide: HERO_SERVICE_PARAMS, useValue: params },
  ];
}

// application side
bootstrapApplication(AppComponent, {
  providers: [
    provideHeroService({...})
  ],
});
```

このように Provider Function という形式によって、アプリケーションから動的なパラメータを受け取りつつ、その入力値を静的に型チェックし、プロバイダーの宣言詳細をライブラリに閉じることができている。ライブラリ内部で使っている DI トークンが外部に露出していないため、ライブラリ側で実装の詳細を変更してもアプリケーション側に影響することもない。

必ずしも命名規則に従わなくてもいいし、DI トークンを露出してアプリケーション側でプロバイダーを宣言してもらう方法を選ぶことが禁止されるわけでもないが、標準ライブラリの API に一貫したパターンがあるということで開発者はそれを真似するようになるだろうし、現に NgRx のようなサードパーティライブラリも追従を始めている。あえてこの流れに逆らう意味は見出しにくいだろう。

## まとめ

`provideRouter()` に代表される **Provide Function パターン** は、これまで `forRoot()` パターンが担ってきたプロバイダー宣言への動的なパラメータ適用のための慣例的な実装パターンが、NgModule を使わない形で生まれ変わったものであり、特別に新しい仕組みが導入されたわけではない。だが、クラスの静的メソッドから単純な関数に変わったことで、これまでよりもシンプルに、そして柔軟に扱いやすくなっている。

今後、標準ライブラリや多くのサードパーティライブラリの API がこの形に統一されていくだろう。このようなパターンがあると知っておくことで、新たに導入される API の振る舞いや利用方法が推測しやすくなるはずだ。

また、この Provider Function と対になるような **“Injector Function”** というパターンも新たに生まれようとしている。そしてこれらをセットにした **“Functional DI”** パターンについては、また別の記事で紹介したい。

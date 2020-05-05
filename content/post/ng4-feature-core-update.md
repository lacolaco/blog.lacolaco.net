---
date: "2017-03-09T08:21:22+09:00"
title: "[Angular 4.0] core/commonモジュールの変更について"
tags: [angular, core, common]
---

Angular 4.0新機能シリーズ第4弾です。今回はcoreモジュールとcommonモジュールに入った変更について解説します。

<!--more-->

## coreモジュールの変更

coreモジュールにはDependency Injectionとテンプレートシンタックスに変更が入っています。

### `OpaqueToken`の廃止と`InjectionToken<T>`の導入

ひとつめはDependency Injectionに関する変更です。
これまでInjectionのキーとして使われていた`OpaqueToken`ですが、4.0ではdeprecatedとなり、5.0で廃止されることになりました。
代わりに、`InjectionToken`というクラスが導入され、今後はこちらを使うことになります。

`InjectionToken`はInjectする対象の型情報をジェネリックとして持つことができます。
この変更に伴って`Injector`にも変更が入っており、第1引数が`InjectionToken`のときは戻り値の型が推論されるようになっています。
たとえば文字列を注入するときは次のように書きます。

```ts
/** これまで **/

const APP_NAME = new OpaqueToken('appName');

{
    providers: [{ provider: APP_NAME, useValue: 'My Awesome App'}]
}

const appName = injector.get(APP_NAME) as string; // any型なのでキャストが必要

/** これから **/

const APP_NAME = new InjectionToken<string>('appName');

{
    providers: [{ provider: APP_NAME, useValue: 'My Awesome App'}]
}

const appName = injector.get(APP_NAME); // APP_NAMEから自動的にstring型になる
```

多くの場合、明示的なキャストが不要になり、簡潔なコードを書けるようになるでしょう。
もしユニットテストのモックなどで、`InjectionToken<T>`と互換性のないものを注入したいときは、逆に明示的なキャストがないとコンパイルエラーになります。

### ライフサイクルメソッドのinterface化

これは一種の破壊的変更になりえるのですが、これまで抽象クラスとして提供されていた`OnInit`や`AfterViewInit`などが、インターフェースとして提供されるようになります。
公式ドキュメントやほぼすべてのガイドでは`implements OnInit`という書き方で解説しているのですが、もし`extends OnInit`と記述している人がいれば4.0からは動かなくなりますので注意してください。

### `<template>`タグに関する仕様変更

これまでテンプレート中で`<template>`タグを使うと`TemplateRef`のインスタンスが生成され、再利用可能なテンプレート部品として使えるようにできました。
しかしその際にAngularは最終的なDOMの出力から`<template>`タグを除去してしまいます。
`<template>`タグはHTMLの標準要素であり、Web Componentsの普及や他のライブラリによるタグの利用もあるので、あまり好ましくない挙動でした。

これを解決するために、4.0では新しく`<ng-template>`というテンプレートシンタックスを導入しました。
これはこれまでの`<template>`タグとまったく同じ使い方で、`TemplateRef`への参照を作成するためのタグです。
もちろんこれまでの`<template>`タグの利用も可能ですが、おそらく5.0アップデート時には完全な切り替えが行われます。
アプリケーション中で`<template>`タグを使っているところがあれば、早めに書き直しておきましょう。

ちなみに、2系と同じ`<template>`タグの動きを維持する挙動は無効にできます。
コンパイラの`enableLegacyTemplate`オプションが`false`に指定されていると、`<template>`タグは完全にAngularの干渉を受けなくなります。
JiTコンパイルのときは`bootstrapModule`関数の第2引数でコンパイラの設定ができます。

```ts
boostrapModule(AppModule, {
    enableLegacyTemplate: false
});
```

AoTコンパイルのときは、tsconfig.jsonやAoTPluginなどの`angularCompilerOptions`で設定できます。

```json
{
    "angularCompilerOptions": {
        "enableLegacyTemplate": false
    },
    "compilerOptions": {
    }
}
```

### Renderer周辺の変更

4.0でもっとも大きな変更は、DOMレンダリングの内部機構の完全刷新です。
これまで使われていた`Renderer`に代わる`Renderer2`がフルスクラッチで実装され、4.0からはそちらが使われています。
より高速で軽量になっていますが、これまでRendererの深いAPIを使っていた開発者にとっては僅かな修正が必要かもしれません。

`RootRenderer`クラスは完全に廃止されていますので、代わりに`RendererFactory2`を使います。
なお、`Renderer`クラスはまだInjectして使用できますが、非推奨になり、内部的には`Renderer2`に処理を委譲しています。
今後は`Renderer2`を使うようにしましょう。

## commonモジュールの新機能

`NgIf`の改善以外にも、commonモジュールにはいくつかの新機能が追加されました。

### `NgComponentOutlet`の導入

ダイアログのような用途で、コンポーネントを動的にテンプレートに追加したいケースで、これまでは`ViewContainer`などのAPIを用いていましたが、
4.0から専用の`NgComponentOutlet`というディレクティブが追加されて簡単に書けるようになります。

`NgComponentOutlet`は`NgTemplateOutlet`と似ていて、次のように使います。

```ts
import { MyDialogComponent } from './my-dialog.component';

@Component({
    template: `
    <ng-container *ngComponentOutlet="dialogCmpType"></ng-container>
    `
})
export class MyCmp {
    dialogCmpType = MyDialogComponent;
}
```

注意としては、これまでと同様、動的に追加されるコンポーネントは`NgModule`の`entryComponents`に設定するのを忘れないようにしましょう。

詳しいAPIについては[APIドキュメント](https://github.com/angular/angular/blob/master/modules/%40angular/common/src/directives/ng_component_outlet.ts#L13-L70)を参考にしてください。

### `titlecase`パイプの追加

これまで`uppercase`と`lowercase`しか用意されていませんでしたが、単語の先頭だけを大文字にする`titlecase`パイプが追加されました。

## まとめ

- `OpaqueToken`から`InjectionToken<T>`へ
- `<template>`から`<ng-template>`へ
- `NgComponentOutlet`で動的なコンポーネント生成
- `titlecase`パイプの追加
- `OnInit`のインターフェース化
- `Renderer`のバージョンアップ

----
**Angular 4.0 Features**

- [新しいngIfの使い方](/post/ng4-feature-ngif/)
- [Metaサービスの使い方](/post/ng4-feature-meta-service/)
- [formsモジュールの更新について](/post/ng4-feature-forms-update/)
- [core/commonモジュールの変更について](/post/ng4-feature-core-update/)
- [router/http/animationsモジュールの変更について](/post/ng4-feature-libs-update/)

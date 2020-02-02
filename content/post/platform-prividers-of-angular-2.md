+++
date = "2016-04-22T09:48:29+09:00"
title = "Angular 2のPlatform Provider"

+++

Angular 2のDependency Injection(DI)は主にサービスクラスのインスタンスを注入するのに用いられますが、
実は他にも便利な使い方がいくつかあります。
今回はその中から `PLATFORM_DIRECTIVES` と `PLATFORM_PIPES` の使い方を紹介します。

<!--more-->

## Angular 2のProviderと`multi`オプション
まずはじめに、Angular 2のProviderの仕組みについておさらいしましょう。
もしAngular 2のDIがさっぱりわからない方は、先に [Angular2のDIを知る](http://qiita.com/laco0416/items/61eed550d1f6070b36ab) を読むといいかもしれません。

Angular 2のDIは基本的に、 **トークン** に対して値をセットします。
TypeScriptでは「型ベースのDI」とよく言われますが、これは型(型アノテーションに使われているクラス)がトークンになっています。
このトークンはクラスじゃなくてもよくて、文字列でも何でも、オブジェクトであれば何でも許容されます。

```ts
providers: [
    MyClass, // 自動的にMyClassがインスタンス化される
    new Provider(MyClass, {useClass: MyClass}), // 上と同義
    new Provider("myValue", {useValue: "value"}, // 文字列をトークンにする 
]    
```

Angular 2では、トークンを定数として提供して、ユーザーが値を自由にセットできるようにしているものがいくつかあります。
代表的なのは`APP_BASE_HREF`です。これはAngular 2の`Location`がベースパスとして使うバスを設定するためのトークンです

```ts
new Provider(APP_BASE_HREF, {useValue: "/basepath/"})
```

さらにもう一つ重要なのは、`＠Component`や`bootstrap`でProviderが要求される場面では、Providerの配列を渡せるということです。
配列を渡した場合は内部で自動的に展開されるので、複数のProviderが依存しあっている場合に1つの配列にまとめることができます。

```ts
const MY_PROVIDERS = [
    MyClassA,
    new Provider(MyClassB, {useValue: new MyClassB("initial")}),
    new Provider(MyClassC, {
        useFactory: (myClassA: MyClassA, myClassB: myClassB) => {
            myClassA.init();
            return new MyClassC(myClassA, myClassB);
        },
        deps: [MyClassA, MyClassB]
    }
]

...

providers: [
     MY_PROVIDERS
]    
``` 

### `multi` オプション
さて、Angular 2のDIの基礎を振り返ったところで、ここから先の話で必要になるのが `multi`オプションです。
Providerは、同じトークンに対して2回値をセットすると、先にProvideした方は上書きされてしまいます。

```ts
[
    MyClass,
    new Provider(MyClass, {useClass: MockMyClass}) // 上書きする
]
``` 

`multi`オプションは、同じトークンに対して複数のProvideを行うときに、上書きではなく **追加** を行います。
次の例では、複数のクラスをまとめるトークンを作り、`multi`で追加しています。

```ts
[
    new Provider(MY_PROVIDERS, {useClass: MyClassA, multi: true}),
    new Provider(MY_PROVIDERS, {useClass: MyClassB, multi: true}),
    new Provider(MY_PROVIDERS, {useClass: MyClassC, multi: true}),
]
```

このオプションを使うことで、配列をInjectしたい場合にその要素を動的に追加することができます。

## `PLATFORM_DIRECTIVES` トークン
というわけで、ようやく本題に入れます！
`PLATFORM_DIRECTIVES`トークンは、`multi`オプションでProviderを追加されることを想定してAngular 2が提供しているものです。
その名の通り、プラットフォーム全体で使えるディレクティブを提供するトークンです。

[PLATFORM_DIRECTIVES - ts](https://angular.io/docs/ts/latest/api/core/PLATFORM_DIRECTIVES-let.html)

例えば、アプリケーション全体で使うモーダルのコンポーネント `ModalComponent` を作ったとしましょう。

```ts
@Component({
    selector: "my-modal",
    template: `...`
})
class ModalComponent {
    ...
}
``` 

このコンポーネントを別のコンポーネントから使うには、使う側のコンポーネントの `directives` にクラスを指定しないといけません。

```ts
@Component({
    selector: "my-app",
    template: "<my-model></my-model>",
    directives: [ModalComponent]
})
class AppComponent {
}
```

この`ModalComponent`を他にも多くのコンポーネントから呼び出す時、毎回`directives`を設定するのは面倒ですね？
そんな時に`PLATFORM_DIRECTIVES`の出番です。

`PLATFORM_DIRECTIVES`に`ModalComponent`を追加することで、プラットフォームの共通ディレクティブであるとして自動的に解決してくれるようになります。

```ts
new Provider(PLATFORM_DIRECTIVES, {useValue: [ModalComponent], multi: true})
```

もっとも便利なユースケースは、`ROUTER_DIRECTIVES`でしょう。
angular2/routerが提供している`routerLink`や`<router-outlet>`をコンポーネントから使うには、`directives: [ROUTER_DIRECTIVES]` という記述が必要です。
ここで`PLATFORM_DIRECTIVES`を使うと、アプリケーション全体でどこでも使えるようになります。

```ts
new Provider(PLATFORM_DIRECTIVES, {useValue: ROUTER_DIRECTIVES, multi: true})
```

汎用的なコンポーネントやディレクティブを作った時には、ぜひ活用してみてください。

## `PLATFORM_PIPES`
ここまで理解した方ならもう説明の必要はないでしょう。名前の通り、プラットフォーム全体で使えるパイプを定義できるトークンです。
汎用的なパイプを作った時に活用すると、毎回 `pipes: [MyPipe]` を書く必要はありません。

[PLATFORM_PIPES - ts](https://angular.io/docs/ts/latest/api/compiler/PLATFORM_PIPES-let.html)

```ts
new Provider(PLATFORM_PIPES, {useValue: [MyPipe], multi:true});
``` 

## おまけ: `OpaqueToken`
もし `PLATFORM_DIRECTIVES`や`PLATFORM_PIPES`というトークンがどうやって作られいるのか気になった方は、無事にAngular 2中級者への階段を踏み出しています！
これらは `OpaqueToken` というクラスのインスタンスになっています。
このクラスは、Providerのトークンとして使いやすいインスタンスを提供してくれます。

[OpaqueToken - ts](https://angular.io/docs/ts/latest/api/core/OpaqueToken-class.html)

```ts
var t = new OpaqueToken("value");
var injector = Injector.resolveAndCreate([
  provide(t, {useValue: "bindingValue"})
]);
expect(injector.get(t)).toEqual("bindingValue");
```

定数として`OpaqueToken`のインスタンスを作っておいてアプリケーションで使うようにすると、柔軟なDIを行うことができるでしょう！

## まとめ
`PLATFORM_DIRECTIVES`と`PLATFORM_PIPES`を使うと、
汎用的なコンポーネントやディレクティブ、パイプを毎回宣言することなく、どこでも使えるようになります。
アプリケーションが大きくなってきたらぜひ活用してみてください。


+++
date = "2017-03-07T23:25:38+09:00"
title = "[Angular 4.0] Metaサービスの使い方"

+++

Angular 4.0で追加された新しい組み込みサービス、`Meta`について解説します。

<!--more-->

## `Meta`サービス

`Meta`サービスは、その名のとおり、HTMLの`<meta>`タグに対する操作を行うためのサービスです。
`@angular/platform-browser`パッケージから提供されていて、2.0ですでに実装されている`Title`サービスと同じように使用できます。

```ts
import { Meta } from '@angular/platform-browser';

@Injectable()
export class MyService {
    constructor(metaService: Meta) {}
}
```

### `getTag(attrSelector: string): HTMLMetaElement`

`getTag`メソッドは、引数の`attrSelector`に該当するmetaタグ要素を取得するものです。
`attrSelector`は通常のCSSセレクタではなく、属性をベースにした文字列です。
たとえば`property`が`fb:app_id`のmetaタグを取得したい場合は次のように呼び出します。

```ts
const tag = metaService.getTag('property=fb:app_id');
```

同じ引数で、複数件の戻り値を返せる`getTags`もあります。

```ts
const tags = metaService.getTags('name=author');
```

### `addTag(tag: MetaDefinition, forceCreation: boolean = false): HTMLMetaElement`

`addTag`メソッドは新しくmetaタグをheadに追加するためのものです。
引数は`MetaDefinition`型のオブジェクトと、すでに同じmetaタグが存在するときに上書きするかどうかのフラグです。
戻り値には新しく生成された、あるいはすでに存在していたmetaタグ要素が渡されます。

`MetaDefinition`インターフェースは次のような定義になっています。

```ts
export type MetaDefinition = {
  charset?: string; 
  content?: string; 
  httpEquiv?: string; 
  id?: string; 
  itemprop?: string;
  name?: string;
  property?: string;
  scheme?: string;
  url?: string;
}
```

実際の使い方は次のようになります。

```ts
metaService.addTag({name: 'author', content: 'page author'});
```

こちらも同時に複数件を処理する`addTags`メソッドが用意されています。

```ts
metaService.addTags([
    {name: 'twitter:title', content: 'Content Title'},
    {property: 'og:title', content: 'Content Title'}
]);
```

### `updateTag(tag: MetaDefinition, selector?: string): HTMLMetaElement`

`updateTag`メソッドはすでに存在するmetaタグを更新するためのものです。
第2引数にセレクタが渡されなければ、第1引数の`name`や`property`をもとに更新対象を自動で判別します。
また、対象が存在しなければmetaタグの追加を行います。

### `removeTag(attrSelector: string): void`

`removeTag`メソッドはセレクタにヒットしたmetaタグを除去します。

### `removeTagElement(meta: HTMLMetaElement): void`

こちらは、セレクタではなくmetaタグ要素を受け取り、その要素をDOM上から除去します。

## まとめ

これまでSNSへのシェアなどのためにmetaタグを操作する必要があったときは、直接DOMを操作する必要がありました。
ただブラウザ上で動かすだけなら問題ないですが、Angularはクロスプラットフォームに動作できることが目標なので、これは避けるべきものでした。

今回導入された`Meta`はAngular内部で統合されているので、
将来的にはUniversalによるサーバーサイドレンダリング時にも使えて、SEOのためのmetaタグ操作も可能になるよう設計されています。
ぜひ独自のサービスから組み込みの`Meta`に乗り換えておきたいところです。
ただし、このAPIはまだexperimentalなので、半年後の次期メジャーアップデート(5.0)の時には多少の破壊的変更が入るかもしれないことに留意しましょう。

`Meta`についてもっと知りたい方は[ソースコード](https://github.com/angular/angular/blob/master/modules/%40angular/platform-browser/src/browser/meta.ts)や、
[テストコード](https://github.com/angular/angular/blob/master/modules/%40angular/platform-browser/test/browser/meta_spec.ts)を
読むとよいでしょう。

----
**Angular 4.0 Features**

- [新しいngIfの使い方](/post/ng4-feature-ngif/)
- [Metaサービスの使い方](/post/ng4-feature-meta-service/)
- [formsモジュールの更新について](/post/ng4-feature-forms-update/)
- [core/commonモジュールの変更について](/post/ng4-feature-core-update/)
- [router/http/animationsモジュールの変更について](/post/ng4-feature-libs-update/)
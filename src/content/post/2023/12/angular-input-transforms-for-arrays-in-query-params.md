---
title: 'Angular: 配列クエリパラメータのためのInput Transforms'
slug: 'angular-input-transforms-for-arrays-in-query-params'
icon: ''
created_time: '2023-12-04T12:24:00.000Z'
last_edited_time: '2023-12-30T09:58:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Input-Transforms-b01d0937931d4a748ff31a416346feab'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular v16で導入されたInput Transformsは、 `@Input({ transform: transformFn })` というように関数を渡すことでインプットプロパティに値がセットされるときの変換処理を宣言できる。典型的なユースケースは、 `<button disable>` のようにHTML標準のブール値属性の挙動を模倣したディレクティブやコンポーネントを作成するときにブール値に変換する用途だろう。また、 `<img width="16">` のように数値を受け取る属性も、HTML属性としての振る舞いを模倣するなら文字列から変換することになる。

[Accepting data with input properties • Angular](https://angular.dev/guide/components/inputs#input-transforms)

```ts
import {Component, Input, booleanAttribute, numberAttribute} from '@angular/core';
@Component({...})
export class CustomSlider {
  @Input({transform: booleanAttribute}) disabled = false;
  @Input({transform: numberAttribute}) number = 0;
}
```

この機能と、同じくAngular v16で導入されたRouterのComponent Input Bindingを併用することで、配列型のデータをクエリパラメータに変換するユースケースが扱いやすくなる。

## クエリパラメータ内の配列

[配列型をクエリパラメータとして表現する形式にはさまざまなパターンがある](https://medium.com/raml-api/arrays-in-query-params-33189628fa68)が、Routerの `navigate()` メソッドや `RouterLink` で配列型の値をクエリパラメータに指定すると、Angularは同じキーのパラメータを複数回繰り返す `key=param1&key=param2` という形式に変換する。

![image](/images/angular-input-transforms-for-arrays-in-query-params/Untitled.png)

```ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink],
  template: `
    <router-outlet />
    <ul>
      <li><a routerLink="" [queryParams]="{ query: null }">no query</a></li>
      <li><a routerLink="" [queryParams]="{ query: 1 }">query=1</a></li>
      <li><a routerLink="" [queryParams]="{ query: [1] }">query=[1]</a></li>
      <li><a routerLink="" [queryParams]="{ query: [1, 2] }">query=[1,2]</a></li>
    </ul>
  `,
})
export class App {}

const routes: Routes = [
  {
    path: '',
    component: Page,
  },
];

bootstrapApplication(App, {
  providers: [provideRouter(routes, withComponentInputBinding())],
});
```

クエリパラメータに配列型を書き込むのは簡単だが、逆にクエリパラメータから読み取るのは少し工夫が必要になる。なぜかというと、この形式では `query=1` だけが存在する場合に**それがもともと配列であったかどうかという情報が失われる**からだ。つまり、配列ではない値 `{ query: 1 }` と長さ1の配列 `{ query: [1] }` から出力されるクエリパラメータがどちらも同じ結果になってしまうのだ。

![image](/images/angular-input-transforms-for-arrays-in-query-params/Untitled.png)

このことを念頭に入れておかないと、次のようなナイーブな実装はすぐに実行時エラーを投げるだろう。 Routerの `withComponentInputBinding()` オプションによって次の `query` インプットプロパティにはクエリパラメータの値がセットされるが、クエリパラメータに書き込むときに配列だったとしても長さが1であれば単なる文字列になってしまい、 `query.join()` メソッドは文字列に存在しないためエラーになる。

```ts
@Component({
  standalone: true,
  imports: [JsonPipe],
  template: ` <div>query={{ query.join(', ') }}</div> `,
})
export class Page {
  @Input()
  query: string[] = [];
}
```

![image](/images/angular-input-transforms-for-arrays-in-query-params/Untitled.png)

また、当然だがクエリパラメータがない場合も想定する必要があるため、この `query` インプットプロパティの本当の型は `string[] | string | undefined` である。しかし誰もこんな型のインプットプロパティを扱いたくはない。そこで冒頭で触れたInput Transformsを使おう。

ちなみに、オブジェクトとクエリパラメータを相互に変換する振る舞いは`UrlSerializer`を独自に拡張することで変更できる。

https://angular.io/api/router/UrlSerializer

## 配列への正規化

Input Transformsを使い、 `query` インプットプロパティを常に `string[]` 型として扱えるように正規化することができる。 `normalizeQuery` という関数でその変換処理を行うとすると、コンポーネント側は次のように書ける。`normalizeQuery` は `string[] | string | undefined` の引数を受け取って `string[]` を返す関数ならどんな実装でも問題ない。

```ts
function normalizeQuery(value: string | string[] | undefined): string[] {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value;
  }
  return [value];
}

@Component({...})
export class Page {
  @Input({ transform: normalizeQuery })
  query: string[] = [];
}
```

実際に動作するサンプルコードをStackblitzで公開しているので、試してみてほしい。

https://stackblitz.com/edit/angular-xjw1sl?ctl=1&embed=1&file=src/main.ts

## まとめ

- 長さ1の配列をクエリパラメータにセットすると、Routerはそれを配列としてパースできない。
- クエリパラメータが存在しないことも考慮して正規化をする必要がある。
- RouterのComponent Input BindingとInput Transformsを使うと、正規化された値を直接インプットプロパティで受け取ることができる。

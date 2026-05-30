---
title: 'Angular: 属性値からの型変換が書きやすくなるinput transforms'
slug: 'angular-new-input-transforms'
icon: ''
created_time: '2023-05-10T15:31:00.000Z'
last_edited_time: '2026-03-28T16:17:00.000Z'
tags:
  - 'commit note'
published: true
locale: 'ja'
category: 'Tech'
channels:
  - 'Code'
  - 'Angular'
notion_url: 'https://www.notion.so/Angular-input-transforms-2131694edc7e4221ad63e13b749d4fc0'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular v16.0が出て間もないが、なかなか面白そうな機能追加が進んでいる。

https://github.com/angular/angular/pull/50225

端的には、次のようなコードが書けるようになる。テンプレートでのプロパティバインディングとしては `string` 型で受け取りつつも、受け取った内部では `number` 型のプロパティとして保持するために、型変換を挟んでいる。

```typescript
// foo.directive.ts
@Directive()
export class Foo {
  @Input({transform: (incomingValue: string) => parseInt(incomingValue)}) value: number;
}
```

これと同様のことはこれまで Setterプロパティと Angular CDK の `coercion` ユーティリティが解決してきた。

```typescript
import { NumberInput, coerceNumberProperty } from '@angular/cdk/coercion';

@Directive()
export class Foo {
  #value: number;

  @Input() 
  set value(v: NumberInput) {
    this.#value = coerceNumberProperty(v);
  }
}
```

https://material.angular.io/cdk/coercion/overview

なぜこのような型変換が必要かというと、HTMLの仕様上、 `[prop]` というように `[]` を伴わない属性値の指定では、それをインプットプロパティが受け取る時に `string` か `undefined` にしかならないからだ。

```html
<some [disabled]="true" /> // boolean

<some disabled="true" />   // string

<some disabled />          // undefined
```

特に問題になるのは `disabled` のようにboolean型のインプットとしてもサポートしつつ、その属性がついているだけでも `true` 扱いにするような、HTML標準の属性に振る舞いを合わせるときだ。これはいままではCDKを使って次のように書いていた。

```typescript
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

@Directive()
export class Foo {
  #disabled = false;

  @Input() 
  set disabled(v: BooleanInput) {
    this.#disabled = coerceBooleanProperty(v);
  }
  get disabled() {
    return this.#disabled;
  }
}
```

これが冒頭で紹介した新しい書き方だと次のように書けそうだ。

```typescript
import { BooleanInput, coerceBooleanProperty } from '@angular/cdk/coercion';

@Directive()
export class Foo {
  @Input({ transform: coerceBooleanProperty }) disabled = false;
}
```

おそらく順当に進めば v16.1 で導入されるのではなかろうか？汎用性の高いコンポーネントやディレクティブを作る上ではボイラープレートコードを減らしてくれそうなので、期待したい。

## 参考リンク

- Add Superpowers to your Angular Inputs 🔋 (New feature 🎉) | by Enea Jahollari | May, 2023 | ITNEXT [https://itnext.io/add-superpowers-to-your-angular-inputs-new-feature-4fb89b31b6e8](https://itnext.io/add-superpowers-to-your-angular-inputs-new-feature-4fb89b31b6e8)


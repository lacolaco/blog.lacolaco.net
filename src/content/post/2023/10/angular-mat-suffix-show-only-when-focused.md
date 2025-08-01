---
title: 'Angular MatSuffixをフォーカス中だけ表示する'
slug: 'angular-mat-suffix-show-only-when-focused'
icon: ''
created_time: '2023-10-18T02:50:00.000Z'
last_edited_time: '2023-12-30T10:00:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Angular Material'
  - 'tailwindcss'
published: true
locale: 'ja'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-mat-suffix-show-only-when-focused'
notion_url: 'https://www.notion.so/Angular-MatSuffix-40f4e1df5de545b9b837f96a36605ba9'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular Material の MatFormField と MatInput を使う場面で、フォーカスにより MatSuffix の表示状態を制御する方法の一例を紹介する。ユーザーに対する入力中のヒントを表示するのに便利なケースがあるかもしれない。

<figure>
  <img src="/images/angular-mat-suffix-show-only-when-focused/capture.gif" alt="テキストフィールドにフォーカスがあるときだけMatSuffix要素が可視化される">
  <figcaption>テキストフィールドにフォーカスがあるときだけMatSuffix要素が可視化される</figcaption>
</figure>

サンプルコードでは TailwindCSS の標準ユーティリティクラスを使うが、原理的にはCSSで実現しているのと変わらない。

https://stackblitz.com/edit/i7rk3p?ctl=1&embed=1&file=src/app/app.component.ts

## MatSuffixの準備

まずはフォーカスによるMatSuffixの表示制御をしていない状態はこのような感じになる。

```ts
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatInputModule],
  template: `
    <div class="container p-8">
      <mat-form-field class="w-full">
        <mat-label>Search</mat-label>
        <input matInput type="text" />

        <div matSuffix class="px-2">
          <span class="text-xs text-gray-500">Enter to submit</span>
        </div>
      </mat-form-field>
    </div>
  `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {}
```

ここから、 `<mat-form-field>` 要素にフォーカスがあるときにだけスタイルを適用されるように変更する。

## `:focus-within` 疑似クラス

https://developer.mozilla.org/ja/docs/Web/CSS/:focus-within

今回のように、親要素のフォーカスにより子孫要素に条件付きのスタイルを付与する場合に使えるのは`:focus-within` 擬似クラスである。 実際にフォーカスを受けるのは `<input>` 要素だが、`:focus-within` 擬似クラスによって `<input>` 要素を内包する `<mat-form-field>` 要素を起点にCSSを記述できる。

TailwindCSSでは、 `group-{modifer}` 機能を使って実装できる。フォーカス状態を監視する親要素に `group` クラスを付与し、スタイルを変更する子要素に `group-focus-within:` モディファイアを利用する。

https://tailwindcss.com/docs/hover-focus-and-other-states#styling-based-on-parent-state

```html
<div class="container p-8">
  <!-- "group" を追加 -->
  <mat-form-field class="w-full group">
    <mat-label>Search</mat-label>
    <input matInput type="text" />

    <!-- "invisible group-focus-within:visible" を追加 -->
    <div matSuffix class="px-2 invisible group-focus-within:visible">
      <span class="text-xs text-gray-500">Enter to submit</span>
    </div>
  </mat-form-field>
</div>
```

素のCSSであれば、上記のHTMLに対して次のように書けば同等のことができる。 `:focus-within` 擬似クラスにより、 `.group` 要素の子孫要素のどれかにフォーカスがあれば `.group:focus-within` セレクタにマッチするようになる。あとはその子孫セレクタで表示状態を切り替えればよい。

```css
.invisible {
  visibility: hidden;
}

.group:focus-within group-focus-within:visible {
  visibility: visible;
}
```

今回は `visibility` で表示状態を切り替えているが、別に `display` による切り替えでも問題はない。

---
title: 'Angular: ボタンコンポーネントの実装'
date: '2022-07-20T02:25:00.000Z'
updated_at: '2022-07-20T08:03:00.000Z'
tags:
  - 'angular'
  - 'components'
  - 'a11y'
  - 'HTML'
  - 'button'
draft: false
source: 'https://www.notion.so/Angular-4518985f136b48118aefe72b464720a4'
---

多くの Angular アプリケーションの開発では、再利用可能な UI コンポーネントの実装が必要になるだろう。この記事では、基本的な UI コンポーネントの代表例として、**ボタンコンポーネント**の実装において考慮すべき点を踏まえながら、典型的な実装例を示す。

## ボタンコンポーネントのよくある失敗

HTML には標準の `<button>` 要素がある。そのため、わざわざボタンコンポーネントを実装する目的は、たいてい `<button>` 要素の標準のデザインではなく、独自の装飾を加え、それをアプリケーション中で再利用するためである。

`<button>` 要素はユーザーが直接操作する対話型のコンテンツであり、HTML の中でも特にアクセシビリティの保証が重要になる。また、 `<button>` 要素はただクリックイベントを発火するだけでなく、多くの属性や振る舞いが複雑に絡み合っているため、カスタム要素で `<button>` 要素を再現することは難しい。

{{< embed "https://developer.mozilla.org/ja/docs/Web/HTML/Element/button" >}}

そのため、次のように `<button>` 要素をラップしたボタンコンポーネントはアクセシビリティの確保に苦労することになる。

```typescript
@Component({
  selector: 'app-fancy-button',
  template: `
    <button class="fancy-button">
      <ng-content></ng-content>
    </button>
  `,
  styleUrls: ['./fancy-button.component.css'],
})
export class FancyButtonComponent {}
```

たとえば、 `<button>` 要素には `type` 属性がある。フォームの中に組み込まれる場合は任意の指定ができなければ不便だ。また、 `disabled` 属性や `aria-hidden` のような ARIA 属性も考えると、 `<app-fancy-button>` コンポーネントは `<button>` タグが受け取ることのできるすべての属性を橋渡ししなければならない。

```typescript
@Component({
  selector: 'app-fancy-button',
  template: `
    <button
      class="fancy-button"
      [attr.type]="type"
      　　　　　　　　　　　　[attr.aria-hidden]="ariaHidden"
      [disabled]="disabled"
    >
      <ng-content></ng-content>
    </button>
  `,
  styleUrls: ['./fancy-button.component.css'],
})
export class FancyButtonComponent {
  @Input() type: string = 'button';
  @Input() disabled: boolean = false;
  @Input('aria-hidden') ariaHidden?: string;
  // etc...
}
```

ボタンコンポーネントが利用されるユースケースが少なければ、ユースケースに特化した必要最小限の振る舞いだけを実装すればよいが、ライブラリとして使いやすい汎用的なコンポーネントに発展させようとするときにはこの作りは足かせになる。

## 属性セレクタによるボタンコンポーネント

このようなケースでよく採用されるのが、ボタンコンポーネントのセレクタを**属性セレクタ**にする方法である。Angular Material の MatButton コンポーネントがその代表例だ。

{{< embed "https://material.angular.io/components/button/overview" >}}

コンポーネントはほとんどの場合で要素セレクタを持ち、カスタム要素として DOM 上に配置されるが、この振る舞いは `@Component` デコレーターの `selector` プロパティが要素セレクタだからである。そして、コンポーネントのセレクタの形式を変えるとそれぞれ違った振る舞いになる。

先ほどの `FancyButtonComponent` を次のように書き換えよう。注目すべき点は `selector` プロパティが、 `app-fancy-button` という要素セレクタから、 `button[app-fancy-button]` という要素と属性の合成セレクタになっていることだ。

```typescript
@Component({
  selector: 'button[app-fancy-button]',
  template: `<ng-content></ng-content>`,
  styleUrls: ['./fancy-button.component.css'],
})
export class FancyButtonComponent {}
```

このセレクタによって、 `<button>` 要素のうち `app-fancy-button` 属性を持つものだけが`FancyButtonComponent` だと識別される。したがって、このコンポーネントを使うテンプレートは次のようになる。

```html
<button app-fancy-button (click)="onClick()">Click Me</button>
```

テンプレート上には標準の `<button>` 要素がそのまま記述されているため、ボタンコンポーネントの利用者は、 `<button>` 要素固有の属性や振る舞いに自由にアクセスできる。このような実装ならば、 `FancyButtonComponent` はホスト要素に対する CSS スタイリングだけを担うことができる。

実装の詳細は、次の動作するサンプルを参考にしてほしい。

{{< stackblitz "https://stackblitz.com/edit/angular-ivy-qxbz13?embed=1&file=src/app/fancy-button/fancy-button.component.ts" >}}

### 参考リンク

リッチかつアクセシブルなボタンコンポーネントの実装テクニックをまとめている次の記事も、汎用的なボタンコンポーネントが備えるべき振る舞いを知るためのいい資料になるだろう。

{{< embed "https://web.dev/building-a-button-component/" >}}
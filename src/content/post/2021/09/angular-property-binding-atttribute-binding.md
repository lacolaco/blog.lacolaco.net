---
title: 'Angular: なぜプロパティバインディングと属性バインディングは分かれているのか'
slug: 'angular-property-binding-atttribute-binding'
icon: ''
created_time: '2021-09-03T00:00:00.000Z'
last_edited_time: '2023-12-30T10:07:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-bdddec227b87480180bd0660353509c9'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular を勉強中のとある学生から質問をもらった。いい質問だったので将来同じことを疑問に思う人のためにも書き残しておこうと思う。

## なぜプロパティバインディングと属性バインディングは分かれているのか

「属性は HTML タグに付与する情報で、プロパティは DOM 要素に紐づくものだということはわかっているけど、データバインディングにおいてこれを区別する必要がなぜあるのか？」という質問をもらった。

これに対して、要約すると「対応するプロパティがない属性や、属性とプロパティで名前が異なる場合があり、そういうときに属性バインディングでしかバインディングできないから」というように答えた。

公式ドキュメントでは [属性、クラス、スタイルのバインディング](https://angular.jp/guide/attribute-binding)に記載がある。

[https://angular.jp/guide/attribute-binding](https://angular.jp/guide/attribute-binding)

### プロパティバインディングと属性バインディング

プロパティバインディングは次のようにその HTML 要素のプロパティ名を指定してデータバインディングするものである。

```html
<a [href]="someUrl"></a>
```

これはプロパティバインディングなので、データバインディングの対象は `HTMLAnchorElement.href` プロパティである。 このプロパティに値をセットすると、ブラウザ（DOM）が自動的に `href`属性のほうにも反映してくれるので、結果的にプロパティと属性の両方にバインディングできたように見える。 しかし実際にバインディングされているのはプロパティだけで、**プロパティから属性への反映は Angular がやっていることではない**。

### `colspan` と `colSpan`

プロパティバインディングはプロパティを対象にするため、指定できる名前はプロパティとして定義されたものに限られる。 これのわかりやすい例が `<td>` 要素の `colSpan` プロパティだ。 `colSpan` プロパティは HTML としては `colspan` 属性で定義されていて、`S`の大文字/小文字が違う。

この場合、プロパティバインディングを使う場合は `[colSpan]`、属性バインディングが使う場合は `[attr.colspan]` と書く必要がある。 ただし、どちらにバインディングしてももう一方への反映は DOM のほうで行われるので、この場合はどちらを選んでも問題はない。

### ARIA 属性

属性バインディングでなければ記述できないのは、対応するプロパティが存在しない場合である。代表例は `aria-label` などの ARIA 属性だ。

```html
<!-- 間違い: プロパティバインディングはできない -->
<button [aria-label]="buttonLabel">X</button>

<!-- 正解: 属性バインディングを使う -->
<button [attr.aria-label]="buttonLabel">X</button>
```

属性バインディングを使うユースケースは、基本的に属性バインディングでしか記述できないときだけだ。 プロパティバインディングと違い、属性名は任意の名前を設定できるため、間違った名前の属性にバインディングしてもテンプレートコンパイルは成功してしまう。 プロパティバインディングであれば未定義のプロパティへのバインディングはエラーとして検出してくれるため、使えるならできるだけプロパティバインディングを使おう。

### まとめ

プロパティバインディングと属性バインディングが区別されている理由は、属性バインディングでしか記述できない場合があるからだ、ということを改めて解説した。 適切に使い分けるというよりは、属性バインディングはプロパティバインディングでカバーできないユースケースを補うための機能として捉えておくのがいいだろう。

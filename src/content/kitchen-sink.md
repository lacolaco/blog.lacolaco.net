---
title: Kitchen Sink
---

# Markdown構文サンプル集

この記事は、ブログシステムでサポートされているMarkdown構文のサンプル集です。各構文の入力と出力が確認できます。

## 基本構文

### 見出し

**入力:**

```markdown
# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6
```

**出力:**

# Heading 1

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

---

### 段落とテキスト装飾

**入力:**

```markdown
通常の段落テキスト [リンク付き](https://www.google.com)

複数行 **太字テキスト**
_斜体テキスト_ ~~取り消し線~~
`インラインコード` **_太字と斜体の組み合わせ_**
```

**出力:**

通常の段落テキスト [リンク付き](https://www.google.com)

複数行 **太字テキスト**
_斜体テキスト_ ~~取り消し線~~
`インラインコード` **_太字と斜体の組み合わせ_**

---

### 画像

**入力:**

```markdown
![代替テキスト](https://placehold.co/600x400)
```

**出力:**

![代替テキスト](https://placehold.co/600x400)

---

### HTMLの図表要素

**入力:**

```html
<figure>
  <img src="https://placehold.co/600x400" />
  <figcaption>キャプション付きの画像</figcaption>
</figure>
```

**出力:**

<figure>
  <img src="https://placehold.co/600x400">
  <figcaption>キャプション付きの画像</figcaption>
</figure>

---

## リスト

### 箇条書きリスト

**入力:**

```markdown
- リストアイテム1
- リストアイテム2
  - ネストしたアイテム2-1
  - ネストしたアイテム2-2
  - **太字**を含むアイテム
- リストアイテム3
  - ネストしたアイテム3-1
```

**出力:**

- リストアイテム1
- リストアイテム2
  - ネストしたアイテム2-1
  - ネストしたアイテム2-2
  - **太字**を含むアイテム
- リストアイテム3
  - ネストしたアイテム3-1

---

### 番号付きリスト

**入力:**

```markdown
1. 番号付きリストアイテム1
2. 番号付きリストアイテム2
   1. ネストした番号付きアイテム2-1
   2. ネストした番号付きアイテム2-2
```

**出力:**

1. 番号付きリストアイテム1
2. 番号付きリストアイテム2
   1. ネストした番号付きアイテム2-1
   2. ネストした番号付きアイテム2-2

---

## 区切り線

**入力:**

```markdown
---
```

**出力:**

---

## 引用

### 基本的な引用

**入力:**

```markdown
> これは引用です。引用内で**太字**も使用できます。
```

**出力:**

> これは引用です。引用内で**太字**も使用できます。

---

### 複数行引用

**入力:**

```markdown
> 複数行の引用です。
>
> - 引用内のリストアイテム
> - 引用内のリストアイテム
>
> 引用内の段落テキスト
> 複数行にわたって書くことができます
```

**出力:**

> 複数行の引用です。
>
> - 引用内のリストアイテム
> - 引用内のリストアイテム
>
> 引用内の段落テキスト
> 複数行にわたって書くことができます

---

## コード

### インラインコード

**入力:**

```markdown
段落内の`インラインコード`の使用例です。
```

**出力:**

段落内の`インラインコード`の使用例です。

---

### コードブロック（言語指定なし）

**入力:**

````markdown
```
function hello() {
  console.log('hello');
}
```
````

**出力:**

```
function hello() {
  console.log('hello');
}
```

---

### コードブロック（TypeScript）

**入力:**

````markdown
```ts
@Component({
  template: '<div>hello</div>',
})
export class Comp {}
```
````

**出力:**

```ts
@Component({
  template: '<div>hello</div>',
})
export class Comp {}
```

---

## アラート

**入力:**

```markdown
> [!NOTE]
> :+1: これは注記アラートです。
> 複数行のアラートも書けます。

> [!TIP]
> より良い方法についての有用なアドバイス。

> [!IMPORTANT]
> ユーザーが知っておくべき重要な情報。

> [!WARNING]
> 問題を避けるために即座に注意が必要な緊急情報。

> [!CAUTION]
> リスクや負の結果についての警告。
```

**出力:**

> [!NOTE]
> :+1: これは注記アラートです。
> 複数行のアラートも書けます。

> [!TIP]
> より良い方法についての有用なアドバイス。

> [!IMPORTANT]
> ユーザーが知っておくべき重要な情報。

> [!WARNING]
> 問題を避けるために即座に注意が必要な緊急情報。

> [!CAUTION]
> リスクや負の結果についての警告。

---

## 詳細表示（折り畳み）

**入力:**

```html
<details>
  <summary>トグルの概要</summary>

  ### 内部見出し 折り畳み内容です。 _斜体テキスト_ も使用できます。 ![](https://placehold.co/600x400)
</details>
```

**出力:**

<details>
<summary>トグルの概要</summary>

### 内部見出し

折り畳み内容です。　*斜体テキスト*　も使用できます。

![](https://placehold.co/600x400)

</details>

---

## 数式

### ブロック数式

**入力:**

```markdown
$$
e=mc^2
$$
```

**出力:**

$$
e=mc^2
$$

---

### インライン数式

**入力:**

```markdown
インライン数式の例：$e=mc^2$
```

**出力:**

インライン数式の例：$e=mc^2$

---

## 図表

### Mermaid図表

**入力:**

````markdown
```mermaid
graph TD;
  A-->B;
  A-->C;
  B-->D;
  C-->D;
```
````

**出力:**

```mermaid
graph TD;
  A-->B;
  A-->C;
  B-->D;
  C-->D;
```

---

## 表

**入力:**

```markdown
| 列1     | 列2     |
| ------- | ------- |
| セル1,1 | セル1,2 |
| セル2,1 | セル2,2 |
```

**出力:**

| 列1     | 列2     |
| ------- | ------- |
| セル1,1 | セル1,2 |
| セル2,1 | セル2,2 |

---

## 自動埋め込み対応URL

### 通常のリンク

**入力:**

```markdown
[NotionヘッドレスCMS化記録 (1) Notion APIとTypeScript](https://blog.lacolaco.net/2022/02/notion-headless-cms-1/)
```

**出力:**

[NotionヘッドレスCMS化記録 (1) Notion APIとTypeScript](https://blog.lacolaco.net/2022/02/notion-headless-cms-1/)

---

### 通常URLの埋め込み

**入力:**

```markdown
https://github.com/makenotion/notion-sdk-js
```

**出力:**

https://github.com/makenotion/notion-sdk-js

---

### Twitter埋め込み

**入力:**

```markdown
https://twitter.com/laco2net/status/1492833480694439940?s=20&t=d9u_aBlsmuSrdXTYPSHXkw
```

**出力:**

https://twitter.com/laco2net/status/1492833480694439940?s=20&t=d9u_aBlsmuSrdXTYPSHXkw

---

### YouTube埋め込み

**入力:**

```markdown
https://www.youtube.com/watch?v=TmWIrBPE6Bc
```

**出力:**

https://www.youtube.com/watch?v=TmWIrBPE6Bc

---

### StackBlitz埋め込み

**入力:**

```markdown
https://stackblitz.com/edit/angular-ivy-qxbz13?embed=1&file=src/app/fancy-button/fancy-button.component.ts
```

**出力:**

https://stackblitz.com/edit/angular-ivy-qxbz13?embed=1&file=src/app/fancy-button/fancy-button.component.ts

---

### Google Slides埋め込み

**入力:**

```markdown
https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/pub
```

**出力:**

https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/pub

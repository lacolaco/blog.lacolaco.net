---
title: Kitchen Sink
slug: kitchen-sink
icon: '📝'
created_time: '2022-02-11T11:47:00.000Z'
last_edited_time: '2025-06-07T14:22:00.000Z'
category: 'Tech'
tags: ['test']
published: false
notion_url: 'https://www.notion.so/Kitchen-Sink-80f5c54939b64e7ab25825bdb35f1cae'
---

# Markdown構文サンプル集

この記事は、ブログシステムでサポートされているMarkdown構文のサンプル集です。各構文の入力と出力が確認できます。

## 基本構文

### 見出し

# Heading 1

## Heading 2

### Heading 3

---

### 段落とテキスト装飾

通常の段落テキスト [リンク付き](https://www.google.com/)

複数行 **太字テキスト**
_斜体テキスト_ ~~取り消し線~~
`インラインコード` **_太字と斜体の組み合わせ_**

---

### 画像

![](https://placehold.co/600x400)

---

### HTMLの図表要素

<figure>
  <img src="https://placehold.co/600x400" alt="キャプション付きの画像">
  <figcaption>キャプション付きの画像</figcaption>
</figure>

---

## リスト

### 箇条書きリスト

- リストアイテム1
- リストアイテム2
  - ネストしたアイテム2-1
  - ネストしたアイテム2-2
  - **太字**を含むアイテム
- リストアイテム3
  - ネストしたアイテム3-1

---

### 番号付きリスト

1. 番号付きリストアイテム1
2. 番号付きリストアイテム2
   1. ネストした番号付きアイテム2-1
   2. ネストした番号付きアイテム2-2

---

## 区切り線

---

## 引用

> これは引用です。引用内で太字も使用できます。

---

### 複数行引用

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

段落内の`インラインコード`の使用例です。

---

### コードブロック（言語指定なし）

```
function hello() {
  console.log('hello');
}
```

---

### コードブロック（TypeScript）

```ts
@Component({
  template: '<div>hello</div>',
})
export class Comp {}
```

---

## アラート

> [!NOTE]
> NOTE: これは注記アラートです。
> 複数行のアラートも書けます。

> [!IMPORTANT]
> IMPORTANT: ユーザーが知っておくべき重要な情報。

> [!WARNING]
> WARNING: 問題を避けるために即座に注意が必要な緊急情報。

---

## 詳細表示（折り畳み）

<details>
<summary>トグルの概要</summary>

### 内部見出し

折り畳み内容です。*斜体テキスト*も使用できます。

![](https://placehold.co/600x400)

</details>

---

## 数式

### ブロック数式

$$
e=mc^2
$$

---

### インライン数式

インライン数式の例：$e=mc^2$

---

## 図表

### Mermaid図表

```mermaid
graph TD;
  A-->B;
  A-->C;
  B-->D;
  C-->D;

```

---

## 表

### ヘッダー付き表

| 列1     | 列2     |
| ------- | ------- |
| セル1,1 | セル1,2 |
| セル2,1 | セル2,2 |

### ヘッダーなし表

|         |         |
| ------- | ------- |
| セル1,1 | セル1,2 |
| セル2,1 | セル2,2 |

---

## 自動埋め込み対応URL

### 通常のリンク

[NotionヘッドレスCMS化記録 (1) Notion APIとTypeScript](https://blog.lacolaco.net/2022/02/notion-headless-cms-1/)

---

### 通常URLの埋め込み

https://github.com/makenotion/notion-sdk-js

---

### Twitter埋め込み

https://twitter.com/laco2net/status/1492833480694439940?s=20&t=d9u_aBlsmuSrdXTYPSHXkw

---

### YouTube埋め込み

https://www.youtube.com/watch?v=TmWIrBPE6Bc

---

### StackBlitz埋め込み

https://stackblitz.com/edit/angular-ivy-qxbz13?embed=1&file=src/app/fancy-button/fancy-button.component.ts

---

### Google Slides埋め込み

https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/pub

---
title: 'Astroの画像最適化を利用する'
slug: '8892acbcdb0e'
icon: ''
created_time: '2023-12-27T05:34:00.000Z'
last_edited_time: '2025-06-11T08:37:00.000Z'
category: 'Tech'
tags:
  - 'Astro'
  - 'Blog Dev'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Astro-a1bb976f7cd04fd0a8927a6ada485f97'
features:
  katex: false
  mermaid: false
  tweet: false
---

ブログ記事中の画像を表示するために、Astroの画像最適化機能を使うようにした。これまではオリジナルの画像をそのまま`img`タグに渡しており、`width`や`height`も設定していなかったため、読み込みパフォーマンスの面でもレイアウトシフトの面でも問題があったが、手抜きで放置していた。

Astroの画像最適化は、`Image`コンポーネントを使うのが簡単だ。だが、ブログの作りの上で工夫が必要な点があった。

https://docs.astro.build/ja/guides/images/

ブログ記事中の画像は外部URLで配信されているものと、CMS（Notion）で管理しているローカル管理のものがある。今回はローカル管理のものに限って`Image`コンポーネントを使うようにした。外部URLのものはせめてもの最適化ということで`decoding="async”`だけは有効にした。

https://developer.mozilla.org/ja/docs/Web/API/HTMLImageElement/decoding

```ts
{
  external ? (
    <img src={url} decoding="async" />
  ) : (
    <AstroImage
      src={images[url]()}
    />
  )
}
```

ローカル画像のほうは、次のガイドを参考に動的読み込みを使って解決した。

https://docs.astro.build/ja/recipes/dynamically-importing-images/

```ts
const images = import.meta.glob<{ default: ImageMetadata }>('/src/content/images/**/*.{jpg,jpeg,png,gif,svg}');
if (!external && !images[url]) {
  throw new Error(`"${url}" does not exist in glob: "src/content/images/**/*"`);
}
```

はじめは直接 `import(url)` の戻り値をImageコンポーネントに渡していたが、`astro dev`では読み込めるものの、`astro build`すると画像ファイルの読み込みに失敗した。Viteの内部的なビルドシステムに起因してそうだ。`import.meta.glob`を使うやり方では問題なく動作した。

ということで、Astroのビルド時に画像の幅・高さの設定とwebpへの最適化、遅延読み込みの有効化などが自動的に行われるようになった。めでたしめでたし。

![image](/images/8892acbcdb0e/001_2.png)

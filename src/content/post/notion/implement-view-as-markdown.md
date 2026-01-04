---
title: 'ブログにView as Markdownを実装した'
slug: 'implement-view-as-markdown'
icon: ''
created_time: '2025-12-29T03:11:00.000Z'
last_edited_time: '2025-12-30T12:43:00.000Z'
tags:
  - 'Astro'
  - 'Blog Dev'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/View-as-Markdown-2d83521b014a80c08040d5ad86a2b965'
features:
  katex: false
  mermaid: false
  tweet: false
---

先日からこのブログに “View as Markdown” 機能を実装した。（タイトル右側のMarkdownアイコンが目印）

![image](/images/implement-view-as-markdown/image.a298b21d4e74d435.png)

記事をMarkdownテキストとしてブラウズできるようにしており、記事のURLに `.md` をつけるとMarkdown版にアクセスできる。最近いろんな開発者向けドキュメントサイトなどで見るアレだ。

## Astroでの実装

Astroで実装する場合、シンプルにページとして`[slug].md.ts`というエントリポイントを作成すればいい。

![image](/images/implement-view-as-markdown/CleanShot_2025-12-29_at_10.39.362x.693e806eef34d184.png)

また、記事の本文についてはAstro Content LayerでMarkdownファイルを管理しているのであれば、コンテンツオブジェクトの`.body` プロパティにMarkdown形式の本文がそのまま残っているのでこれを読み取ればよい。Frontmatterも出したければコンテンツオブジェクトのプロパティから復元することができる。

```typescript
import type { CollectionEntry } from 'astro:content';
import yaml from 'yaml';

/**
 * Content Collectionのentryからraw Markdownを取得
 * entry.dataから必要なフィールドのみを選択してFrontmatterを構築し、entry.bodyと結合する
 */
export function readRawMarkdown(entry: CollectionEntry<'posts'>): string {
  if (!entry.body) {
    throw new Error(`Entry ${entry.id} has no body`);
  }

  // 記事ページで表示される情報のみを抽出
  const frontmatter = {
    title: entry.data.title,
    slug: entry.data.slug,
    // ...
  };

  const frontmatterYaml = yaml.stringify(frontmatter);

  // Frontmatter + body を結合
  return `---\n${frontmatterYaml}---\n${entry.body}`;
}
```

LLMへの指示に便利なので多くのサイトがこの慣例でMarkdown形式のコンテンツを配信してくれたら助かるなあと思っている。


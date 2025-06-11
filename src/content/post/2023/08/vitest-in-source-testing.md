---
title: 'VitestのIn-source Testingを試してみた'
slug: 'vitest-in-source-testing'
icon: ''
created_time: '2023-08-22T10:23:00.000Z'
last_edited_time: '2023-12-30T10:01:00.000Z'
category: 'Tech'
tags:
  - 'Testing'
  - 'Vitest'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Vitest-In-source-Testing-579ff1eca68c4fbe9fa67d7c59f1698d'
features:
  katex: false
  mermaid: false
  tweet: false
---

In-source Testingとは、テストコードが実装コードと同じソースファイルに書かれているものである。Rustで有名なアプローチ。

https://doc.rust-jp.rs/book-ja/ch11-03-test-organization.html#非公開関数をテストする

先日から Vitest を何かと使うようになったが、VitestもIn-source Testingをサポートしている。JavaScriptのテストツールでは珍しいのでやってみた。説明としては次の記事のほうが断然詳しい。

https://zenn.dev/azukiazusa/articles/vitest-same-test-file

```ts
// in-source test suites
if (import.meta.vitest) {
  const { describe, it, expect } = import.meta.vitest;
  describe('buildText', () => {
    it('without note', () => {
      const text = buildText({
        notionBlockId: 'blockId',
        url: 'https://example.com',
        title: 'example',
      });
      expect(text).toBe('🔖 "example" https://example.com #laco_feed');
    });

    it('with note', () => {
      const text = buildText({
        notionBlockId: 'blockId',
        url: 'https://example.com',
        title: 'example',
        note: 'note',
      });
      expect(text).toBe('note "example" https://example.com #laco_feed');
    });
  });
}
```

https://github.com/lacolaco/feed2social/blob/466a0e8af91da40911f0ac2ca8981fa5e3cdc34e/src/social/twitter.ts#L56-L79

理解しておくべきポイントは以下

- `import.meta.vitest` の型定義は tsconfig の `types` オプションに渡した `vitest/importMeta` が持っている。
  - [https://github.com/vitest-dev/vitest/blob/main/packages/vitest/importMeta.d.ts](https://github.com/vitest-dev/vitest/blob/main/packages/vitest/importMeta.d.ts)
- テスト記述用のAPIは普通の静的なインポートではなく、 `import.meta.vitest` から取得する。`import.meta.vitest` が定義されていないときにif文全体がデッドコードとなることで、アプリケーションをバンドルするときにテスト関連のコードがまるごと除去できる。

## 所感

- テストを書くためにその関数の可視性がどうだとか悩む必要がないので、とにかくまずテストを書き始めるということをやりやすい。
- テストが実装とすぐ近くにあるので、テストファーストの開発スタイルには特に向いていると思う。
- 当然だがファイルが大きくなりやすいが、実装が増えたにしろテストが増えたにしろそれはつまりそのファイルの関心事が増えているということなので、関心を分離しろということになる。テストファイルがどんどん大きくなっていくのは見逃されやすいので、実装と同じファイルであることで「適切に困る」ことができそうだ。

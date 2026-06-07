import { strict as assert } from 'node:assert';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import remarkResolveNotionMentions from './index.ts';

const fixturesDir = join(import.meta.dirname, 'fixtures');
const notionPostsDir = join(fixturesDir, 'notion-posts');
const userPostsDir = join(fixturesDir, 'user-posts');

const PAST = '2026-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

function writePost(dir: string, filename: string, frontmatter: Record<string, string | boolean>): void {
  const yaml = Object.entries(frontmatter)
    .map(([k, v]) => (typeof v === 'boolean' ? `${k}: ${v}` : `${k}: '${v}'`))
    .join('\n');
  writeFileSync(join(dir, filename), `---\n${yaml}\n---\n\nbody\n`);
}

before(() => {
  mkdirSync(notionPostsDir, { recursive: true });
  mkdirSync(join(userPostsDir, 'subdir'), { recursive: true });

  // notion-posts (sync 出力): published, ja
  writePost(notionPostsDir, 'alpha.md', {
    title: 'Alpha',
    slug: 'alpha',
    published: true,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Alpha-ja-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  });

  // notion-posts (sync 出力): published, en (filename .en.md で判定)
  writePost(notionPostsDir, 'alpha.en.md', {
    title: 'Alpha (en)',
    slug: 'alpha',
    // frontmatter.locale はあえて書かない (collection 側が source-of-truth)
    published: true,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Alpha-en-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  });

  // notion-posts (sync 出力): published, dense-hex 形式の notion_url
  writePost(notionPostsDir, 'beta.md', {
    title: 'Beta',
    slug: 'beta',
    published: true,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Beta-cccccccccccccccccccccccccccccccc',
  });

  // notion-posts (sync 出力): dashed UUID 形式の notion_url (Share menu copy link)
  writePost(notionPostsDir, 'gamma.md', {
    title: 'Gamma',
    slug: 'gamma',
    published: true,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Gamma-dddddddd-dddd-dddd-dddd-dddddddddddd',
  });

  // notion-posts: draft (published: false) — map に入らず throw 経路へ
  writePost(notionPostsDir, 'draft.md', {
    title: 'Draft',
    slug: 'draft',
    published: false,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Draft-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  });

  // notion-posts: 未来日記 (created_time が未来) — map に入らず throw 経路へ
  writePost(notionPostsDir, 'future.md', {
    title: 'Future',
    slug: 'future',
    published: true,
    created_time: FUTURE,
    last_edited_time: FUTURE,
    notion_url: 'https://www.notion.so/Future-ffffffffffffffffffffffffffffffff',
  });

  // user-posts (直接執筆): published, ja
  writePost(userPostsDir, 'manual.md', {
    title: 'Manual',
    slug: 'manual',
    published: true,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Manual-11111111111111111111111111111111',
  });

  // user-posts/subdir: 直接執筆ツリーは再帰的に走査される (content.config.ts の glob と一致)
  writePost(join(userPostsDir, 'subdir'), 'nested.md', {
    title: 'Nested',
    slug: 'nested',
    published: true,
    created_time: PAST,
    last_edited_time: PAST,
    notion_url: 'https://www.notion.so/Nested-22222222222222222222222222222222',
  });
});

after(() => {
  rmSync(fixturesDir, { recursive: true, force: true });
});

async function processMd(markdown: string): Promise<string> {
  const file = await remark()
    .use(remarkParse)
    .use(remarkResolveNotionMentions, { postDirs: [notionPostsDir, userPostsDir] })
    .use(remarkStringify)
    .process(markdown);
  return String(file);
}

describe('remarkResolveNotionMentions', () => {
  describe('page mention link の書き換え', () => {
    test('ja 記事の dense-hex notion_url が /posts/<slug> に書き換わる', async () => {
      const out = await processMd(
        'See [Alpha](https://www.notion.so/Alpha-ja-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) for more.',
      );
      assert.ok(out.includes('[Alpha](/posts/alpha)'), out);
      assert.ok(!out.includes('notion.so'), out);
    });

    test('en 記事 (filename .en.md) は /posts/<slug>.en に書き換わる', async () => {
      const out = await processMd(
        'See [Alpha](https://www.notion.so/Alpha-en-bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb) for more.',
      );
      assert.ok(out.includes('[Alpha](/posts/alpha.en)'), out);
    });

    test('複数の notion.so URL が同じ markdown 内で全て書き換わる', async () => {
      const out = await processMd(
        'See [Alpha](https://www.notion.so/Alpha-ja-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa) and [Beta](https://www.notion.so/Beta-cccccccccccccccccccccccccccccccc).',
      );
      assert.ok(out.includes('[Alpha](/posts/alpha)'), out);
      assert.ok(out.includes('[Beta](/posts/beta)'), out);
    });

    test('直接執筆ツリー (content/posts/) の記事も解決対象に含まれる', async () => {
      const out = await processMd('See [Manual](https://www.notion.so/Manual-11111111111111111111111111111111).');
      assert.ok(out.includes('[Manual](/posts/manual)'), out);
    });

    test('直接執筆ツリーのサブディレクトリ内の記事も再帰的に走査される', async () => {
      const out = await processMd('See [Nested](https://www.notion.so/Nested-22222222222222222222222222222222).');
      assert.ok(out.includes('[Nested](/posts/nested)'), out);
    });
  });

  describe('Notion page id の正規化 (dense / dashed UUID / query / fragment)', () => {
    test('dashed UUID 形式の page mention link も同じ post に解決する', async () => {
      const out = await processMd('See [Gamma](https://www.notion.so/Gamma-dddddddd-dddd-dddd-dddd-dddddddddddd).');
      assert.ok(out.includes('[Gamma](/posts/gamma)'), out);
    });

    test('frontmatter dense, body dashed の混在でも解決する', async () => {
      // alpha.md の notion_url は dense-hex で書かれているが、本文側が dashed UUID で書かれていても照合する
      const out = await processMd('See [Alpha](https://www.notion.so/Alpha-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa).');
      assert.ok(out.includes('[Alpha](/posts/alpha)'), out);
    });

    test('frontmatter dashed, body dense の混在でも解決する', async () => {
      // gamma.md の notion_url は dashed UUID で書かれているが、本文側が dense-hex でも照合する
      const out = await processMd('See [Gamma](https://www.notion.so/Gamma-dddddddddddddddddddddddddddddddd).');
      assert.ok(out.includes('[Gamma](/posts/gamma)'), out);
    });

    test('query string 付きの page mention URL も書き換わる (Notion gallery view 由来)', async () => {
      const out = await processMd(
        'See [Alpha](https://www.notion.so/Alpha-ja-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa?v=abc123).',
      );
      assert.ok(out.includes('[Alpha](/posts/alpha)'), out);
    });

    test('fragment (#section) は preserve される (heading anchor 対応)', async () => {
      const out = await processMd(
        'See [Alpha](https://www.notion.so/Alpha-ja-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa#section).',
      );
      assert.ok(out.includes('[Alpha](/posts/alpha#section)'), out);
    });
  });

  describe('publication invariant (未公開・未来日記・他配信の検出)', () => {
    test('frontmatter に存在しない notion.so page URL → throw', async () => {
      await assert.rejects(
        () => processMd('See [Unknown](https://www.notion.so/Unknown-99999999999999999999999999999999).'),
        /Unresolved Notion page URL/,
      );
    });

    test('draft (published: false) page への mention → throw', async () => {
      await assert.rejects(
        () => processMd('See [Draft](https://www.notion.so/Draft-eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee).'),
        /Unresolved Notion page URL/,
      );
    });

    test('未来日記 (created_time が未来) への mention → throw', async () => {
      await assert.rejects(
        () => processMd('See [Future](https://www.notion.so/Future-ffffffffffffffffffffffffffffffff).'),
        /Unresolved Notion page URL/,
      );
    });

    test('エラーメッセージに該当 URL が含まれる（操作のヒントになる）', async () => {
      await assert.rejects(
        () => processMd('See [Unknown](https://www.notion.so/Unknown-99999999999999999999999999999999).'),
        /Unknown-99999999999999999999999999999999/,
      );
    });
  });

  describe('対象外のリンクは触らない', () => {
    test('外部 URL（notion.so 以外）は変更されない', async () => {
      const out = await processMd('See [Example](https://example.com/page).');
      assert.ok(out.includes('[Example](https://example.com/page)'), out);
    });

    test('blog 内相対 URL は変更されない', async () => {
      const out = await processMd('See [Existing](/posts/something).');
      assert.ok(out.includes('[Existing](/posts/something)'), out);
    });

    test('リンクを含まない markdown は no-op', async () => {
      const out = await processMd('Just plain text.\n');
      assert.equal(out.trim(), 'Just plain text.');
    });

    test('notion.so のマーケティング/ヘルプ URL は page mention ではないので触らない', async () => {
      // https://www.notion.so/ja-jp/web-clipper のように page id 形式を持たない URL は
      // Notion 製品サイトへの外部 link であって page reference ではない
      const out = await processMd('See [Web Clipper](https://www.notion.so/ja-jp/web-clipper) for more.');
      assert.ok(out.includes('[Web Clipper](https://www.notion.so/ja-jp/web-clipper)'), out);
    });
  });
});

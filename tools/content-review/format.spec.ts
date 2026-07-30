import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { formatNgComment, type Entry } from './format.ts';

const OWNER = 'lacolaco';
const SUMMARY = '誤字を1件検出しました。';

const NOTION: Entry = {
  path: 'content/notion/posts/foo.md',
  provenance: 'notion-sync',
  notionUrl: 'https://www.notion.so/foo-0130436c887b4cf5ac53b2bb027855a6',
};
const TRANSLATED: Entry = {
  path: 'content/notion/posts/foo.en.md',
  provenance: 'auto-translated',
  jaSource: 'content/notion/posts/foo.md',
};
const DIRECT: Entry = {
  path: 'content/notion/posts/hand-written.en.md',
  provenance: 'direct',
};

function comment(entries: Entry[]): string {
  return formatNgComment({
    owner: OWNER,
    summary: SUMMARY,
    issues: [{ file: 'content/notion/posts/foo.md', description: '「〜すす」→「〜する」' }],
    entries,
  });
}

describe('formatNgComment', () => {
  test('owner をメンションし summary と指摘を並べる', () => {
    const body = comment([]);
    assert.match(body, /^## コンテンツレビュー NG\n\n@lacolaco 修正が必要です。\n\n誤字を1件検出しました。\n/);
    assert.match(body, /- \*\*content\/notion\/posts\/foo\.md\*\*: 「〜すす」→「〜する」/);
  });

  test('出自の節は該当する entry があるときだけ出る', () => {
    const body = comment([]);
    assert.doesNotMatch(body, /### Notion 原稿を修正/);
    assert.doesNotMatch(body, /### auto-translate 生成物/);
    assert.doesNotMatch(body, /### 直接管理されているファイル/);
    assert.doesNotMatch(body, /上書きされます/);
  });

  test('notion-sync 由来には原稿 URL を併記する', () => {
    const body = comment([NOTION]);
    assert.match(body, /### Notion 原稿を修正\n\n- `content\/notion\/posts\/foo\.md`: https:\/\/www\.notion\.so\/foo-/);
  });

  test('notion_url が無い notion-sync 由来はプレースホルダを出す', () => {
    const body = comment([{ ...NOTION, notionUrl: undefined }]);
    assert.match(body, /- `content\/notion\/posts\/foo\.md`: \(notion_url なし\)/);
  });

  test('auto-translated には翻訳元を併記する', () => {
    const body = comment([TRANSLATED]);
    assert.match(body, /- `content\/notion\/posts\/foo\.en\.md` \(翻訳元: `content\/notion\/posts\/foo\.md`\)/);
  });

  test('翻訳元が無い auto-translated はパスのみ', () => {
    const body = comment([{ ...TRANSLATED, jaSource: undefined }]);
    assert.match(body, /- `content\/notion\/posts\/foo\.en\.md`\n/);
    assert.doesNotMatch(body, /\(翻訳元:/);
  });

  test('direct は再生成の警告に含めない', () => {
    const body = comment([DIRECT]);
    assert.match(body, /### 直接管理されているファイル/);
    assert.doesNotMatch(body, /上書きされます/);
  });

  test('再生成経路は該当する出自のものだけ挙げる', () => {
    assert.match(comment([NOTION]), /次の sync で上書きされます/);
    assert.match(comment([TRANSLATED]), /次の auto-translate で上書きされます/);
    assert.match(comment([NOTION, TRANSLATED]), /次の sync \/ auto-translate で上書きされます/);
  });

  test('3 出自が混在しても節ごとに振り分ける', () => {
    const body = comment([NOTION, TRANSLATED, DIRECT]);
    const order = ['### Notion 原稿を修正', '### auto-translate 生成物', '### 直接管理されているファイル'].map((h) =>
      body.indexOf(h),
    );
    assert.ok(order.every((i) => i >= 0));
    assert.deepEqual(
      [...order].sort((a, b) => a - b),
      order,
    );
  });
});

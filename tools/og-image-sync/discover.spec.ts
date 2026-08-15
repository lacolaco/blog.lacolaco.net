import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { localeOf, parseTarget, listArticleFiles, isPublished } from './discover.ts';

const frontmatter = [
  '---',
  "title: 'テスト記事'",
  "slug: 'my-post'",
  "created_time: '2024-01-02T03:04:05.000Z'",
  "locale: 'ja'",
  'published: true',
  '---',
  '',
  '本文である。',
  '',
].join('\n');

function createContentDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'og-discover-'));
  mkdirSync(join(root, 'notion/posts'), { recursive: true });
  mkdirSync(join(root, 'posts/nested'), { recursive: true });
  return root;
}

describe('localeOf', () => {
  test('.en.md は en', () => {
    assert.equal(localeOf('/x/content/notion/posts/foo.en.md'), 'en');
  });

  // collection が locale をファイル名から決めている (content.config.ts) ため、frontmatter は出所にしない
  test('.md は ja', () => {
    assert.equal(localeOf('/x/content/notion/posts/foo.md'), 'ja');
  });
});

describe('parseTarget', () => {
  test('frontmatterからslug・title・公開日を取り出す', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/my-post.md');
    writeFileSync(filePath, frontmatter, 'utf8');

    const target = parseTarget(filePath);

    assert.equal(target.slug, 'my-post');
    assert.equal(target.title, 'テスト記事');
    assert.equal(target.locale, 'ja');
    assert.equal(target.publishedDate.toISOString(), '2024-01-02T03:04:05.000Z');
    rmSync(root, { recursive: true, force: true });
  });

  test('ファイル名が <slug>.<locale>.<hash>.png になる', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/my-post.md');
    writeFileSync(filePath, frontmatter, 'utf8');

    const target = parseTarget(filePath);

    assert.match(target.fileName, /^my-post\.ja\.[0-9a-f]{16}\.png$/);
    rmSync(root, { recursive: true, force: true });
  });

  // ja と en は同じ slug を共有するので、出力名は locale で分かれなければならない
  test('同じslugのjaとenで異なるファイル名になる', () => {
    const root = createContentDir();
    const ja = join(root, 'notion/posts/my-post.md');
    const en = join(root, 'notion/posts/my-post.en.md');
    writeFileSync(ja, frontmatter, 'utf8');
    writeFileSync(en, frontmatter.replace('テスト記事', 'Test Post'), 'utf8');

    assert.notEqual(parseTarget(ja).fileName, parseTarget(en).fileName);
    rmSync(root, { recursive: true, force: true });
  });

  test('slugがないファイルはエラーになる', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/broken.md');
    writeFileSync(filePath, "---\ntitle: 'x'\n---\n\n本文\n", 'utf8');

    assert.throws(() => parseTarget(filePath), /slug/);
    rmSync(root, { recursive: true, force: true });
  });

  // ファイル名として書き出すため、パス区切りを含むslugを受け付けてはいけない
  test('パス区切りを含むslugはエラーになる', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/bad.md');
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: '../escaped'"), 'utf8');

    assert.throws(() => parseTarget(filePath), /slug/);
    rmSync(root, { recursive: true, force: true });
  });

  // slug は Astro 側でURL生成に使われ文字種の制限がない。ここで狭めると正当な記事を落とす
  test('非ASCIIのslugを受け付ける', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/ja.md');
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: '日本語'"), 'utf8');

    assert.equal(parseTarget(filePath).slug, '日本語');
    rmSync(root, { recursive: true, force: true });
  });

  test('CRLFのファイルでもfrontmatterを読める', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/crlf.md');
    writeFileSync(filePath, frontmatter.replace(/\n/g, '\r\n'), 'utf8');

    assert.equal(parseTarget(filePath).slug, 'my-post');
    rmSync(root, { recursive: true, force: true });
  });
});

describe('isPublished', () => {
  // ビルド側 (queryAvailablePosts) と同じ規則。未公開記事のslugを公開リポジトリに出さない
  test('published: false は対象外', () => {
    assert.equal(isPublished({ published: false, created_time: '2024-01-01T00:00:00.000Z' }), false);
  });

  test('公開日が未来の記事は対象外', () => {
    assert.equal(isPublished({ published: true, created_time: '2999-01-01T00:00:00.000Z' }), false);
  });

  test('published かつ公開日が過去なら対象', () => {
    assert.equal(isPublished({ published: true, created_time: '2024-01-01T00:00:00.000Z' }), true);
  });

  test('published の指定がなければ対象外', () => {
    assert.equal(isPublished({ created_time: '2024-01-01T00:00:00.000Z' }), false);
  });
});

describe('listArticleFiles', () => {
  test('notion/posts は非再帰、posts は再帰で列挙する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    writeFileSync(join(root, 'notion/posts/a.en.md'), frontmatter, 'utf8');
    writeFileSync(join(root, 'posts/b.md'), frontmatter, 'utf8');
    writeFileSync(join(root, 'posts/nested/c.md'), frontmatter, 'utf8');

    const files = await listArticleFiles(root);

    assert.deepEqual(files.map((f) => f.replace(`${root}/`, '')).sort(), [
      'notion/posts/a.en.md',
      'notion/posts/a.md',
      'posts/b.md',
      'posts/nested/c.md',
    ]);
    rmSync(root, { recursive: true, force: true });
  });

  test('markdown以外は無視する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    writeFileSync(join(root, 'notion/posts/manifest.json'), '{}', 'utf8');

    const files = await listArticleFiles(root);

    assert.equal(files.length, 1);
    rmSync(root, { recursive: true, force: true });
  });
});

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  localeOf,
  parseTarget,
  listArticleFiles,
  isPublished,
  toTargetOrSkip,
  resolveRequestedFiles,
  assertUniqueTargets,
} from './discover.ts';

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

/** リポジトリルート相当。content/ 配下に記事を置く */
function createRepoRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'og-repo-'));
  mkdirSync(join(root, 'content/notion/posts'), { recursive: true });
  return root;
}

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

describe('toTargetOrSkip', () => {
  test('公開記事は生成対象になる', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/my-post.md');
    writeFileSync(filePath, frontmatter, 'utf8');

    assert.equal(toTargetOrSkip(filePath)?.slug, 'my-post');
    rmSync(root, { recursive: true, force: true });
  });

  test('未公開の記事は対象外', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/draft.md');
    writeFileSync(filePath, frontmatter.replace('published: true', 'published: false'), 'utf8');

    assert.equal(toTargetOrSkip(filePath), null);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーには README など記事でないファイルが紛れうる
  test('手書き記事のfrontmatter不在はスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/README.md');
    writeFileSync(filePath, '# 覚書\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath), null);
    rmSync(root, { recursive: true, force: true });
  });

  // parseTarget のバリデーション失敗も1件のスキップで済ませる
  test('手書き記事のtitle欠落はスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/broken.md');
    writeFileSync(filePath, frontmatter.replace("title: 'テスト記事'", "description: 'x'"), 'utf8');

    assert.equal(toTargetOrSkip(filePath), null);
    rmSync(root, { recursive: true, force: true });
  });

  test('手書き記事の不正なslugはスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/bad-slug.md');
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: '../escaped'"), 'utf8');

    assert.equal(toTargetOrSkip(filePath), null);
    rmSync(root, { recursive: true, force: true });
  });

  // sync の出力の不備は異常。黙って落とすとその記事だけOG画像を持たないまま公開される
  test('sync出力のtitle欠落は失敗させる', () => {
    const root = createContentDir();
    const filePath = join(root, 'content/notion/posts/broken.md');
    mkdirSync(join(root, 'content/notion/posts'), { recursive: true });
    writeFileSync(filePath, frontmatter.replace("title: 'テスト記事'", "description: 'x'"), 'utf8');

    assert.throws(() => toTargetOrSkip(filePath), /title/);
    rmSync(root, { recursive: true, force: true });
  });

  // hash算出の失敗はツール側の問題。記事の不備として握りつぶすと、
  // そのバグに気付かないまま1記事が永久にマニフェストから落ちる
  test('手書き記事でもhash算出の失敗は握りつぶさない', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/valid.md');
    writeFileSync(filePath, frontmatter, 'utf8');

    // レンダラ実装を読めないrootDirを渡すと指紋の算出が失敗する
    assert.throws(() => toTargetOrSkip(filePath, join(root, 'missing')), /指紋を算出できない/);
    rmSync(root, { recursive: true, force: true });
  });

  test('sync出力のfrontmatter不在は失敗させる', () => {
    const root = createContentDir();
    const filePath = join(root, 'content/notion/posts/broken.md');
    mkdirSync(join(root, 'content/notion/posts'), { recursive: true });
    writeFileSync(filePath, '本文のみ\n', 'utf8');

    assert.throws(() => toTargetOrSkip(filePath), /frontmatter/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('resolveRequestedFiles', () => {
  // sync は削除やリネームも作業ツリーの差分に出す。消えたファイルで全体を止めない
  test('存在しないファイルは除外する', () => {
    const root = createRepoRoot();
    const exists = join(root, 'content/notion/posts/a.md');
    writeFileSync(exists, frontmatter, 'utf8');

    const resolved = resolveRequestedFiles(['content/notion/posts/a.md', 'content/notion/posts/deleted.md'], root);

    assert.deepEqual(resolved, [exists]);
    rmSync(root, { recursive: true, force: true });
  });

  // 記事以外の出力 (tags.json 等) が同じディレクトリに置かれる
  test('markdown以外は除外する', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');
    writeFileSync(join(root, 'content/notion/posts/tags.json'), '{}', 'utf8');

    const resolved = resolveRequestedFiles(['content/notion/posts/a.md', 'content/notion/posts/tags.json'], root);

    assert.deepEqual(resolved, [article]);
    rmSync(root, { recursive: true, force: true });
  });

  // 呼び出し側は別リポジトリなので、絶対パスで渡されることがある
  test('絶対パスをそのまま解決する', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles([article], root), [article]);
    rmSync(root, { recursive: true, force: true });
  });

  // content 配下でないパスは記事ではない。任意の .md が対象になると
  // 実在しない記事のOG画像が公開バケットに置かれる
  test('content配下でないパスは除外する', () => {
    const root = createRepoRoot();
    writeFileSync(join(root, 'README.md'), frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles(['README.md'], root), []);
    rmSync(root, { recursive: true, force: true });
  });

  test('同じファイルを重ねて渡しても1件になる', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles(['content/notion/posts/a.md', article], root), [article]);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('assertUniqueTargets', () => {
  // ビルド側の assertUniqueSlugs と同じく、同じ slug+locale が2つあれば落とす
  test('slugとlocaleが重複するとエラーになる', () => {
    const root = createContentDir();
    const a = join(root, 'notion/posts/a.md');
    const b = join(root, 'posts/b.md');
    writeFileSync(a, frontmatter, 'utf8');
    writeFileSync(b, frontmatter, 'utf8');

    const targets = [parseTarget(a), parseTarget(b)];

    assert.throws(() => assertUniqueTargets(targets), /重複/);
    rmSync(root, { recursive: true, force: true });
  });

  test('slugが違えば通る', () => {
    const root = createContentDir();
    const a = join(root, 'notion/posts/a.md');
    const b = join(root, 'notion/posts/b.md');
    writeFileSync(a, frontmatter, 'utf8');
    writeFileSync(b, frontmatter.replace("slug: 'my-post'", "slug: 'other-post'"), 'utf8');

    assert.doesNotThrow(() => assertUniqueTargets([parseTarget(a), parseTarget(b)]));
    rmSync(root, { recursive: true, force: true });
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

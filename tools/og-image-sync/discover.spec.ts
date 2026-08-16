import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import {
  localeOf,
  parseTarget,
  listArticleFiles,
  listNotionSubdirectories,
  isPublished,
  toTargetOrSkip,
  assertRenderable,
  assertRequestResolved,
  resolveAllArticles,
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
  test('published: false は対象外', () => {
    assert.equal(isPublished({ published: false, created_time: '2024-01-01T00:00:00.000Z' }), false);
  });

  test('published の指定がなければ対象外', () => {
    assert.equal(isPublished({ created_time: '2024-01-01T00:00:00.000Z' }), false);
  });

  test('published なら対象', () => {
    assert.equal(isPublished({ published: true, created_time: '2024-01-01T00:00:00.000Z' }), true);
  });

  // 公開日が到来しても記事に差分は出ず、生成は起動しない。
  // そのとき画像がないと、サイトだけが公開されてOG画像が404になる
  test('公開日が未来でも対象にする', () => {
    assert.equal(isPublished({ published: true, created_time: '2999-01-01T00:00:00.000Z' }), true);
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

  test('手書きの未公開記事は対象外', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/posts/draft.md');
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    writeFileSync(filePath, frontmatter.replace('published: true', 'published: false'), 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), null);
    rmSync(root, { recursive: true, force: true });
  });

  // 部分一致で判定すると、チェックアウト先の親に notion/posts を含むパスで
  // 手書きの記事まで sync 出力と誤判定され、下書きがあるだけで失敗する
  test('親ディレクトリ名に notion/posts を含んでも手書き記事は対象外', () => {
    const root = mkdtempSync(join(tmpdir(), 'og-nested-'));
    const nested = join(root, 'notion/posts/checkout');
    mkdirSync(join(nested, 'content/posts'), { recursive: true });
    const filePath = join(nested, 'content/posts/README.md');
    writeFileSync(filePath, '# 覚書\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, nested), null);
    rmSync(root, { recursive: true, force: true });
  });

  // 呼び出し側は別リポジトリで、symlink を経由したパスを渡しうる (macOS の /var → /private/var)。
  // 文字列の前置一致だけだと sync 出力を手書き記事と誤判定し、不備を握りつぶす
  test('symlink を経たパスでも sync 出力と判定する', () => {
    const root = mkdtempSync(join(tmpdir(), 'og-symlink-'));
    const real = join(root, 'real');
    mkdirSync(join(real, 'content/notion/posts'), { recursive: true });
    const link = join(root, 'link');
    symlinkSync(real, link);
    const filePath = join(link, 'content/notion/posts/broken.md');
    writeFileSync(filePath, '# frontmatterなし\n', 'utf8');

    assert.throws(() => toTargetOrSkip(filePath, real), /frontmatter/);
    rmSync(root, { recursive: true, force: true });
  });

  // resolveRequestedFiles は notion/posts 直下だけを対象にする。isSyncOutput が深い階層まで
  // sync 出力と見なすと、dropped に落ちたまま誰も気付かない記事が生まれる
  test('notion/posts のサブディレクトリは sync 出力と見なさない', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/notion/posts/sub'), { recursive: true });
    const filePath = join(root, 'content/notion/posts/sub/b.md');
    writeFileSync(filePath, '# frontmatterなし\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), null);
    rmSync(root, { recursive: true, force: true });
  });

  // `..` で始まるファイル名を親への参照と取り違えると、sync 出力の不備を握りつぶす
  test('.. で始まる名前でも sync 出力と判定する', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/..foo.md');
    writeFileSync(filePath, '# frontmatterなし\n', 'utf8');

    assert.throws(() => toTargetOrSkip(filePath, root), /frontmatter/);
    rmSync(root, { recursive: true, force: true });
  });

  // 記事の置き場所そのものが symlink のことがある。基準側だけ末端を残すと、
  // 配下の記事が範囲外に見えて全件が対象外になる
  test('notion/posts 自体が symlink でも sync 出力と判定する', () => {
    const root = mkdtempSync(join(tmpdir(), 'og-dirlink-'));
    const real = join(root, 'store/posts');
    mkdirSync(real, { recursive: true });
    mkdirSync(join(root, 'content/notion'), { recursive: true });
    symlinkSync(real, join(root, 'content/notion/posts'));
    const filePath = join(root, 'content/notion/posts/a.md');
    writeFileSync(filePath, '# frontmatterなし\n', 'utf8');

    assert.throws(() => toTargetOrSkip(filePath, root), /frontmatter/);
    rmSync(root, { recursive: true, force: true });
  });

  // 記事そのものが symlink のことがある。実体の置き場所で判定すると範囲外に見えて
  // 黙って落ちる。範囲は渡されたパスの位置で決める
  test('記事が symlink でも sync 出力と判定する', () => {
    const root = createRepoRoot();
    const outside = join(root, 'outside.md');
    writeFileSync(outside, '# frontmatterなし\n', 'utf8');
    const filePath = join(root, 'content/notion/posts/linked.md');
    symlinkSync(outside, filePath);

    assert.throws(() => toTargetOrSkip(filePath, root), /frontmatter/);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーには README など記事でないファイルが紛れうる
  test('手書き記事のfrontmatter不在はスキップする', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/posts/README.md');
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    writeFileSync(filePath, '# 覚書\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), null);
    rmSync(root, { recursive: true, force: true });
  });

  // parseTarget のバリデーション失敗も1件のスキップで済ませる
  test('手書き記事のtitle欠落はスキップする', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/posts/broken.md');
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    writeFileSync(filePath, frontmatter.replace("title: 'テスト記事'", "description: 'x'"), 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), null);
    rmSync(root, { recursive: true, force: true });
  });

  test('手書き記事の不正なslugはスキップする', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/posts/bad-slug.md');
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: '../escaped'"), 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), null);
    rmSync(root, { recursive: true, force: true });
  });

  // sync の出力の不備は異常。黙って落とすとその記事だけOG画像を持たないまま公開される
  test('sync出力のtitle欠落は失敗させる', () => {
    const root = createContentDir();
    const filePath = join(root, 'content/notion/posts/broken.md');
    mkdirSync(join(root, 'content/notion/posts'), { recursive: true });
    writeFileSync(filePath, frontmatter.replace("title: 'テスト記事'", "description: 'x'"), 'utf8');

    assert.throws(() => toTargetOrSkip(filePath, root), /title/);
    rmSync(root, { recursive: true, force: true });
  });

  // hash算出の失敗はツール側の問題。記事の不備として握りつぶすと、
  // そのバグに気付かないまま記事が黙って落ちる
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

    assert.throws(() => toTargetOrSkip(filePath, root), /frontmatter/);
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
    assert.deepEqual(resolved.files, [exists]);
    assert.deepEqual(resolved.dropped, ['content/notion/posts/deleted.md']);
    rmSync(root, { recursive: true, force: true });
  });

  // 記事以外の出力 (tags.json 等) が同じディレクトリに置かれる
  test('markdown以外は除外する', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');
    writeFileSync(join(root, 'content/notion/posts/tags.json'), '{}', 'utf8');

    const resolved = resolveRequestedFiles(['content/notion/posts/a.md', 'content/notion/posts/tags.json'], root);
    assert.deepEqual(resolved.files, [article]);
    assert.deepEqual(resolved.dropped, ['content/notion/posts/tags.json']);
    rmSync(root, { recursive: true, force: true });
  });

  // 相対と絶対など、同じファイルを別の形で渡されうる。捨てた分も内訳に残さないと、
  // 呼び出し側は渡した件数と結果の件数が合わない理由を追えない
  test('同じファイルを別の形で渡したら片方を重複として残す', () => {
    const root = createRepoRoot();
    writeFileSync(join(root, 'content/notion/posts/a.md'), frontmatter, 'utf8');

    const resolved = resolveRequestedFiles(
      [join(root, 'content/notion/posts/a.md'), 'content/notion/posts/a.md'],
      root,
    );

    assert.equal(resolved.files.length, 1);
    // 警告には捨てた側を、渡された形のまま出す
    assert.deepEqual(resolved.duplicated, ['content/notion/posts/a.md']);
    assert.deepEqual(resolved.dropped, []);
    rmSync(root, { recursive: true, force: true });
  });

  // locale はファイル名から決まる。実体が同じでも ja と en は別の出力になる
  test('en 版が実体への symlink でも重複と見なさない', () => {
    const root = createRepoRoot();
    const ja = join(root, 'content/notion/posts/a.md');
    writeFileSync(ja, frontmatter, 'utf8');
    const en = join(root, 'content/notion/posts/a.en.md');
    symlinkSync(ja, en);

    const resolved = resolveRequestedFiles([ja, en], root);

    assert.deepEqual(resolved.files, [ja, en]);
    assert.deepEqual(resolved.duplicated, []);
    rmSync(root, { recursive: true, force: true });
  });

  // symlink とその実体は同じ記事である。見逃すと2度描いて slug の重複で落ちる
  test('symlink とその実体は重複として扱う', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');
    const alias = join(root, 'content/notion/posts/alias.md');
    symlinkSync(article, alias);

    const resolved = resolveRequestedFiles([article, alias], root);

    assert.deepEqual(resolved.files, [article]);
    assert.deepEqual(resolved.duplicated, [alias]);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書き側が残ると、記事の不備が警告だけで飛ばされる。入力順に依らず notion 側を残す
  test('両ツリーを跨ぐ別名では sync 出力を残す', () => {
    const root = createRepoRoot();
    const notionArticle = join(root, 'content/notion/posts/a.md');
    writeFileSync(notionArticle, frontmatter, 'utf8');
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const alias = join(root, 'content/posts/alias.md');
    symlinkSync(notionArticle, alias);

    const resolved = resolveRequestedFiles([alias, notionArticle], root);

    assert.deepEqual(resolved.files, [notionArticle]);
    assert.deepEqual(resolved.duplicated, [alias]);
    rmSync(root, { recursive: true, force: true });
  });

  // `*.md` という名前でもディレクトリのことがある。記事として読むと EISDIR で全体が止まる
  test('notion 配下の md という名前のディレクトリは失敗させる', () => {
    const root = createRepoRoot();
    const dir = join(root, 'linked');
    mkdirSync(dir, { recursive: true });
    const fake = join(root, 'content/notion/posts/fake.md');
    symlinkSync(dir, fake);

    assert.throws(() => resolveRequestedFiles([fake], root), /ディレクトリがある/);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーは記事以外が混ざる前提なので、対象外にするだけでよい
  test('手書きツリーの md という名前のディレクトリは対象外にする', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const fake = join(root, 'content/posts/fake.md');
    mkdirSync(fake, { recursive: true });

    const resolved = resolveRequestedFiles([fake], root);

    assert.deepEqual(resolved.files, []);
    assert.deepEqual(resolved.dropped, [fake]);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーは不備が混ざる前提。1件の symlink の輪で全体を止めない
  test('手書きツリーの symlink の輪は対象外にする', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const a = join(root, 'content/posts/a.md');
    const b = join(root, 'content/posts/b.md');
    symlinkSync(b, a);
    symlinkSync(a, b);
    const article = join(root, 'content/notion/posts/ok.md');
    writeFileSync(article, frontmatter, 'utf8');

    const resolved = resolveRequestedFiles([a, article], root);

    assert.deepEqual(resolved.files, [article]);
    assert.deepEqual(resolved.dropped, [a]);
    rmSync(root, { recursive: true, force: true });
  });

  // 削除された記事は正常に落とす。実体を失った symlink は sync の異常なので止める
  test('実体を失った sync 出力は失敗させる', () => {
    const root = createRepoRoot();
    const broken = join(root, 'content/notion/posts/broken.md');
    symlinkSync(join(root, 'missing-target.md'), broken);

    assert.throws(() => resolveRequestedFiles([broken], root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // --all は深さを問わず止める。個別指定だけ直下限定だと、経路で扱いが変わる
  test('ネストした位置の実体喪失も失敗させる', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/notion/posts/sub'), { recursive: true });
    const broken = join(root, 'content/notion/posts/sub/a.md');
    symlinkSync(join(root, 'missing-target.md'), broken);

    assert.throws(() => resolveRequestedFiles([broken], root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 1件ずつ投げると、直すたびに次の1件で落ちる
  test('実体喪失をまとめて報告する', () => {
    const root = createRepoRoot();
    const a = join(root, 'content/notion/posts/a.md');
    const b = join(root, 'content/notion/posts/b.md');
    symlinkSync(join(root, 'missing-a.md'), a);
    symlinkSync(join(root, 'missing-b.md'), b);

    assert.throws(() => resolveRequestedFiles([a, b], root), /a\.md.*b\.md/s);
    rmSync(root, { recursive: true, force: true });
  });

  test('削除された記事は失敗させない', () => {
    const root = createRepoRoot();

    const resolved = resolveRequestedFiles([join(root, 'content/notion/posts/deleted.md')], root);

    assert.deepEqual(resolved.files, []);
    assert.equal(resolved.dropped.length, 1);
    rmSync(root, { recursive: true, force: true });
  });

  // 呼び出し側は別リポジトリなので、絶対パスで渡されることがある
  test('絶対パスをそのまま解決する', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles([article], root).files, [article]);
    rmSync(root, { recursive: true, force: true });
  });

  // --all の列挙対象と揃える。ずれると、個別指定でだけ描かれてサイトが参照しない画像が残る
  test('notion/posts のサブディレクトリは除外する', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/notion/posts/sub'), { recursive: true });
    writeFileSync(join(root, 'content/notion/posts/sub/a.md'), frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles(['content/notion/posts/sub/a.md'], root).files, []);
    rmSync(root, { recursive: true, force: true });
  });

  test('posts のサブディレクトリは対象にする', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts/nested'), { recursive: true });
    const nested = join(root, 'content/posts/nested/a.md');
    writeFileSync(nested, frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles(['content/posts/nested/a.md'], root).files, [nested]);
    rmSync(root, { recursive: true, force: true });
  });

  // content 配下でないパスは記事ではない。任意の .md が対象になると
  // 実在しない記事のOG画像が公開バケットに置かれる
  test('content配下でないパスは除外する', () => {
    const root = createRepoRoot();
    writeFileSync(join(root, 'README.md'), frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles(['README.md'], root).files, []);
    rmSync(root, { recursive: true, force: true });
  });

  test('同じファイルを重ねて渡しても1件になる', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');

    assert.deepEqual(resolveRequestedFiles(['content/notion/posts/a.md', article], root).files, [article]);
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
  // `*.md` という名前のディレクトリ symlink を記事扱いすると EISDIR で全体が止まる
  test('md という名前のディレクトリ symlink は記事にしない', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'posts/real.md'), frontmatter, 'utf8');
    const dir = join(root, 'linked');
    mkdirSync(dir, { recursive: true });
    symlinkSync(dir, join(root, 'posts/fake.md'));

    const files = await listArticleFiles(root);

    assert.deepEqual(files, [join(root, 'posts/real.md')]);
    rmSync(root, { recursive: true, force: true });
  });

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

describe('listNotionSubdirectories', () => {
  // sync は flat に書き出す。ディレクトリがあれば、その中の記事は列挙されない
  test('直下のディレクトリを返す', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    mkdirSync(join(root, 'notion/posts/sub'), { recursive: true });

    assert.deepEqual(await listNotionSubdirectories(root), [join(root, 'notion/posts/sub')]);
    rmSync(root, { recursive: true, force: true });
  });

  // 読めないディレクトリは空だと証明できない。中身で判断しないので影響を受けない
  test('中が読めないディレクトリも返す', async () => {
    const root = createContentDir();
    const locked = join(root, 'notion/posts/locked');
    mkdirSync(locked, { recursive: true });
    writeFileSync(join(locked, 'b.md'), frontmatter, 'utf8');
    chmodSync(locked, 0o000);

    try {
      assert.deepEqual(await listNotionSubdirectories(root), [locked]);
    } finally {
      chmodSync(locked, 0o755);
      rmSync(root, { recursive: true, force: true });
    }
  });

  // 中を走査しないので、外を指していても辿らずに済む
  test('ディレクトリへの symlink も返す', async () => {
    const root = createContentDir();
    const outside = mkdtempSync(join(tmpdir(), 'og-outside-'));
    writeFileSync(join(outside, 'b.md'), frontmatter, 'utf8');
    symlinkSync(outside, join(root, 'notion/posts/sub'));

    assert.deepEqual(await listNotionSubdirectories(root), [join(root, 'notion/posts/sub')]);
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  test('ディレクトリが無ければ空', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');

    assert.deepEqual(await listNotionSubdirectories(root), []);
    rmSync(root, { recursive: true, force: true });
  });
});

// 別名で渡された記事を未描画と誤認しないこと
describe('assertRenderable と symlink の別名', () => {
  test('描かれた記事への別名は欠落と見なさない', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');
    mkdirSync(join(root, 'content/notion/posts/sub'), { recursive: true });
    const alias = join(root, 'content/notion/posts/sub/alias.md');
    symlinkSync(article, alias);
    const target = parseTarget(article, process.cwd());

    assert.doesNotThrow(() => assertRenderable({ files: [article], dropped: [alias], duplicated: [] }, [target], root));
    rmSync(root, { recursive: true, force: true });
  });
});

describe('assertRenderable', () => {
  // 公開判定やパスの基準がずれると起こる。アップロード側は空でも正常終了するため気付けない
  test('sync出力があるのに対象0件なら失敗する', () => {
    const root = createRepoRoot();

    assert.throws(
      () =>
        assertRenderable({ files: [join(root, 'content/notion/posts/a.md')], dropped: [], duplicated: [] }, [], root),
      /未公開だった/,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーは下書きだけという状態が正常にありうる
  test('手書き記事だけなら対象0件でも通す', () => {
    const root = createRepoRoot();

    assert.doesNotThrow(() =>
      assertRenderable({ files: [join(root, 'content/posts/draft.md')], dropped: [], duplicated: [] }, [], root),
    );
    rmSync(root, { recursive: true, force: true });
  });

  test('対象があれば通す', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/a.md');
    writeFileSync(filePath, frontmatter, 'utf8');
    const target = parseTarget(filePath, process.cwd());

    assert.doesNotThrow(() => assertRenderable({ files: [filePath], dropped: [], duplicated: [] }, [target], root));
    rmSync(root, { recursive: true, force: true });
  });

  // 直下でない sync 出力は dropped に落ちる。実在する記事なら誰も拾わないまま公開される
  test('dropped に残ったネストした記事は失敗させる', () => {
    const root = createRepoRoot();
    const kept = join(root, 'content/notion/posts/a.md');
    writeFileSync(kept, frontmatter, 'utf8');
    mkdirSync(join(root, 'content/notion/posts/sub'), { recursive: true });
    const nested = join(root, 'content/notion/posts/sub/b.md');
    writeFileSync(nested, frontmatter, 'utf8');
    const target = parseTarget(kept, process.cwd());

    assert.throws(
      () => assertRenderable({ files: [kept], duplicated: [], dropped: [nested] }, [target], root),
      /b\.md/,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 呼び出し側は作業ツリーの差分をそのまま渡す。記事以外の markdown が1つ混ざるだけで
  // 全件止まると、無関係な変更で OG画像の生成ができなくなる
  test('dropped の範囲外 markdown は失敗させない', () => {
    const root = createRepoRoot();
    const kept = join(root, 'content/notion/posts/a.md');
    writeFileSync(kept, frontmatter, 'utf8');
    const readme = join(root, 'README.md');
    writeFileSync(readme, '# 覚書\n', 'utf8');
    const target = parseTarget(kept, process.cwd());

    assert.doesNotThrow(() => assertRenderable({ files: [kept], duplicated: [], dropped: [readme] }, [target], root));
    rmSync(root, { recursive: true, force: true });
  });

  // 同じ手書き記事を2度渡すと片方が dropped に落ちる。描画対象でなくても正常
  test('dropped の手書き記事は失敗させない', () => {
    const root = createRepoRoot();
    const kept = join(root, 'content/notion/posts/a.md');
    writeFileSync(kept, frontmatter, 'utf8');
    const draft = join(root, 'content/posts/draft.md');
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    writeFileSync(draft, frontmatter.replace('published: true', 'published: false'), 'utf8');
    const target = parseTarget(kept, process.cwd());

    assert.doesNotThrow(() => assertRenderable({ files: [kept], duplicated: [], dropped: [draft] }, [target], root));
    rmSync(root, { recursive: true, force: true });
  });

  // 記事以外のファイルが dropped に落ちるのは正常
  test('dropped の記事以外は失敗させない', () => {
    const root = createRepoRoot();
    const kept = join(root, 'content/notion/posts/a.md');
    writeFileSync(kept, frontmatter, 'utf8');
    const other = join(root, 'content/notion/posts/tags.json');
    writeFileSync(other, '{}', 'utf8');
    const target = parseTarget(kept, process.cwd());

    assert.doesNotThrow(() => assertRenderable({ files: [kept], duplicated: [], dropped: [other] }, [target], root));
    rmSync(root, { recursive: true, force: true });
  });

  // 削除された記事や記事以外のファイルは dropped に落ちる。これは正常な同期で起こる
  test('解決の段階で落ちたものは失敗させない', () => {
    const root = createRepoRoot();
    const kept = join(root, 'content/notion/posts/a.md');
    writeFileSync(kept, frontmatter, 'utf8');
    const target = parseTarget(kept, process.cwd());

    assert.doesNotThrow(() =>
      assertRenderable(
        { files: [kept], duplicated: [], dropped: [join(root, 'content/notion/posts/deleted.md')] },
        [target],
        root,
      ),
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 解決は通ったが描画対象にならなかった場合。他に対象があると全体では成功に見える
  test('解決を通った sync 出力が描かれていなければ失敗させる', () => {
    const root = createRepoRoot();
    const kept = join(root, 'content/notion/posts/a.md');
    const skipped = join(root, 'content/notion/posts/b.md');
    writeFileSync(kept, frontmatter, 'utf8');
    const target = parseTarget(kept, process.cwd());

    assert.throws(
      () => assertRenderable({ files: [kept, skipped], dropped: [], duplicated: [] }, [target], root),
      /b\.md/,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 記事の削除だけ、tags.json の更新だけ、という同期では0件が正常
  test('記事が0件なら通す', () => {
    assert.doesNotThrow(() => assertRenderable({ files: [], dropped: [], duplicated: [] }, []));
  });
});

describe('resolveAllArticles', () => {
  test('記事を集める', async () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');

    const resolved = await resolveAllArticles(root);

    assert.deepEqual(resolved.files, [article]);
    rmSync(root, { recursive: true, force: true });
  });

  // rootDir が相対だと、列挙したパスに rootDir が二重に付いて範囲判定が外れ、
  // notion の記事がすべて手書き扱いになって検査が素通りする
  test('相対の rootDir でも未公開を検出する', async () => {
    const root = createRepoRoot();
    writeFileSync(
      join(root, 'content/notion/posts/draft.md'),
      frontmatter.replace('published: true', 'published: false'),
      'utf8',
    );
    const previous = process.cwd();
    process.chdir(dirname(root));

    try {
      const resolved = await resolveAllArticles(basename(root));
      const targets = resolved.files.map((f) => toTargetOrSkip(f, join(dirname(root), basename(root))));
      assert.throws(
        () =>
          assertRenderable(
            resolved,
            targets.filter((t) => t !== null),
            basename(root),
          ),
        /未公開だった/,
      );
    } finally {
      process.chdir(previous);
      rmSync(root, { recursive: true, force: true });
    }
  });

  // 中の記事は列挙されない。存在に気付けないまま公開されるので止める
  test('notion 配下のディレクトリで失敗する', async () => {
    const root = createRepoRoot();
    writeFileSync(join(root, 'content/notion/posts/a.md'), frontmatter, 'utf8');
    mkdirSync(join(root, 'content/notion/posts/sub'), { recursive: true });

    await assert.rejects(() => resolveAllArticles(root), /ディレクトリがある/);
    rmSync(root, { recursive: true, force: true });
  });

  // ディレクトリの検査が先。逆だと、ディレクトリの中の壊れた記事を先に報告してしまう
  test('実体を失った sync 出力で失敗する', async () => {
    const root = createRepoRoot();
    symlinkSync(join(root, 'missing-target.md'), join(root, 'content/notion/posts/broken.md'));

    await assert.rejects(() => resolveAllArticles(root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('assertRequestResolved', () => {
  // 呼び出し側が渡したパスの基準 (blog-content.config.yaml の postsDir) と
  // このツールが見るディレクトリがずれると、全件が対象外になって黙って何も生成されなくなる
  test('全件が対象外なら失敗する', () => {
    assert.throws(
      () =>
        assertRequestResolved(['content/old/posts/a.md'], {
          files: [],
          dropped: ['content/old/posts/a.md'],
          duplicated: [],
        }),
      /対象外/,
    );
  });

  test('1件でも対象があれば通す', () => {
    assert.doesNotThrow(() =>
      assertRequestResolved(['a.md', 'b.json'], {
        files: ['/repo/content/notion/posts/a.md'],
        dropped: ['b.json'],
        duplicated: [],
      }),
    );
  });

  // 削除だけの sync などで対象が空になるのは正常。ここは全件が来ない
  test('入力が空なら通す', () => {
    assert.doesNotThrow(() => assertRequestResolved([], { files: [], dropped: [], duplicated: [] }));
  });
});

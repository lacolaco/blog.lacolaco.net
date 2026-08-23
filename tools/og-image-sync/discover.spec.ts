import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import {
  localeOf,
  parseTarget,
  listArticleFiles,
  isPublished,
  isTarget,
  toTargetOrSkip,
  resolveRequestedFiles,
  assertRequestResolved,
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
  // 外した理由を呼び出し側が数え分けられないと、未公開 (正常) と記述の不備 (異常) が
  // 同じ「描かれなかった1件」に見え、静かな欠落を検知できない
  test('未公開は理由を返す', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/draft.md');
    writeFileSync(filePath, '---\ntitle: a\nslug: a\ncreated_time: 2026-01-01\npublished: false\n---\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'unpublished');
    rmSync(root, { recursive: true, force: true });
  });

  // README のような記事でないファイルは手書きツリーに普通にある。記述の不備と
  // 同じ数に混ぜると、呼び出し側が毎回異常として扱うことになる
  test('frontmatter を持たないファイルは記事でないと返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/README.md');
    writeFileSync(filePath, '# 覚書\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'not-an-article');
    rmSync(root, { recursive: true, force: true });
  });

  // frontmatter が空だと parseYaml は null を返す。投げないので try では捕まらず、
  // 直後の判定が TypeError になって手書きの1ファイルで同期全体が落ちる
  test('空の frontmatter は記事でないと返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/empty.md');
    writeFileSync(filePath, '---\n\n---\n本文\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'not-an-article');
    rmSync(root, { recursive: true, force: true });
  });

  // YAML のタグで Set などにも解決する。オブジェクトではあるが記事の形ではなく、
  // 未公開 (正常) として数えると記述の不備が正常な混入に紛れる
  test('素のオブジェクトでない frontmatter は記事でないと返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/tagged.md');
    writeFileSync(filePath, '---\n!!set\n? a\n---\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'not-an-article');
    rmSync(root, { recursive: true, force: true });
  });

  // 配列に解決する frontmatter も記事ではない。未公開として数えると、
  // 記事でないファイルの混入と区別できなくなる
  test('配列の frontmatter は記事でないと返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/list.md');
    writeFileSync(filePath, '---\n- a\n- b\n---\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'not-an-article');
    rmSync(root, { recursive: true, force: true });
  });

  // スカラーに解決する frontmatter も記事ではない。未公開 (正常) として数えると、
  // 記事でないファイルの混入と区別できなくなる
  test('スカラーの frontmatter は記事でないと返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/scalar.md');
    writeFileSync(filePath, '---\nただの文字列\n---\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'not-an-article');
    rmSync(root, { recursive: true, force: true });
  });

  // 壊れた YAML は記述の不備そのものである。握りつぶさない扱いに入れると、
  // 手書きの記事1件で同期全体が止まる
  test('手書きツリーの壊れた YAML は理由を返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/broken-yaml.md');
    writeFileSync(filePath, "---\ntitle: 'a\ntags: [1,\n---\n", 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'invalid');
    rmSync(root, { recursive: true, force: true });
  });

  test('手書きツリーの記述の不備は理由を返す', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const filePath = join(root, 'content/posts/broken.md');
    writeFileSync(filePath, '---\ntitle: a\npublished: true\n---\n', 'utf8');

    assert.equal(toTargetOrSkip(filePath, root), 'invalid');
    rmSync(root, { recursive: true, force: true });
  });

  test('公開記事は生成対象になる', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/my-post.md');
    writeFileSync(filePath, frontmatter, 'utf8');

    const result = toTargetOrSkip(filePath);
    assert.ok(isTarget(result));
    assert.equal(result.slug, 'my-post');
    rmSync(root, { recursive: true, force: true });
  });

  test('未公開の記事は対象外', () => {
    const root = createContentDir();
    const filePath = join(root, 'notion/posts/draft.md');
    writeFileSync(filePath, frontmatter.replace('published: true', 'published: false'), 'utf8');

    assert.ok(!isTarget(toTargetOrSkip(filePath)));
    rmSync(root, { recursive: true, force: true });
  });

  // slug "og" は R2 でOG画像のキー接頭辞と、リポジトリで記事画像の置き場と衝突する
  test('sync出力のslug "og" は失敗させる', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/og-post.md');
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: 'og'"), 'utf8');

    assert.throws(() => toTargetOrSkip(filePath, root), /R2キー接頭辞と衝突/);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーの不備は1件で全体を止めない。ただし画像も配信もされない
  test('手書き記事のslug "og" はスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/og-post.md');
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: 'og'"), 'utf8');

    assert.ok(!isTarget(toTargetOrSkip(filePath)));
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

    assert.ok(!isTarget(toTargetOrSkip(filePath, nested)));
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

  // 手書きツリーには README など記事でないファイルが紛れうる
  test('手書き記事のfrontmatter不在はスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/README.md');
    writeFileSync(filePath, '# 覚書\n', 'utf8');

    assert.ok(!isTarget(toTargetOrSkip(filePath)));
    rmSync(root, { recursive: true, force: true });
  });

  // parseTarget のバリデーション失敗も1件のスキップで済ませる
  test('手書き記事のtitle欠落はスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/broken.md');
    writeFileSync(filePath, frontmatter.replace("title: 'テスト記事'", "description: 'x'"), 'utf8');

    assert.ok(!isTarget(toTargetOrSkip(filePath)));
    rmSync(root, { recursive: true, force: true });
  });

  test('手書き記事の不正なslugはスキップする', () => {
    const root = createContentDir();
    const filePath = join(root, 'posts/bad-slug.md');
    writeFileSync(filePath, frontmatter.replace("slug: 'my-post'", "slug: '../escaped'"), 'utf8');

    assert.ok(!isTarget(toTargetOrSkip(filePath)));
    rmSync(root, { recursive: true, force: true });
  });

  // sync の出力の不備は異常。黙って落とすとその記事だけOG画像を持たないまま公開される
  test('sync出力のtitle欠落は失敗させる', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/broken.md');
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
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/broken.md');
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

  // 削除された記事は正常に落とす。実体を失った symlink は sync の異常なので止める
  test('実体を失った sync 出力は失敗させる', () => {
    const root = createRepoRoot();
    const broken = join(root, 'content/notion/posts/broken.md');
    symlinkSync(join(root, 'missing-target.md'), broken);

    assert.throws(() => resolveRequestedFiles([broken], root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  test('削除された記事は失敗させない', () => {
    const root = createRepoRoot();

    const resolved = resolveRequestedFiles([join(root, 'content/notion/posts/deleted.md')], root);

    assert.deepEqual(resolved.files, []);
    assert.equal(resolved.dropped.length, 1);
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

  // 記事でない入力でも、読めなかったことは知らせる。混入 (正常) と区別できない
  test('記事でない読めないパスは知らせる', () => {
    const root = createRepoRoot();
    const tags = join(root, 'content/notion/posts/tags.json');
    symlinkSync(join(root, 'content/notion/posts/missing.json'), tags);
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);

    let resolved;
    try {
      resolved = resolveRequestedFiles([tags], root);
    } finally {
      console.warn = original;
    }

    assert.deepEqual(resolved.dropped, [tags]);
    assert.ok(
      warnings.some((warning) => warning.includes('notion の出力の記事でないパスを読めない')),
      `警告が出ていない: ${warnings.join(' / ')}`,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 対象外の内訳では tags.json の混入 (正常) と権限の異常が同じ行に並ぶ
  test('範囲外の読めないパスは知らせる', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/other'), { recursive: true });
    const outside = join(root, 'content/other/a.md');
    symlinkSync(join(root, 'content/other/missing.md'), outside);
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);

    try {
      const resolved = resolveRequestedFiles([outside], root);
      assert.deepEqual(resolved.dropped, [outside]);
    } finally {
      console.warn = original;
    }

    assert.ok(
      warnings.some((warning) => warning.includes('対象範囲の外の記事を読めない')),
      `警告が出ていない: ${warnings.join(' / ')}`,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 届かない置き場所が2階層以上上にあることもある
  test('置き場所の祖先が実体を失った symlink のとき消えたものと扱わない', () => {
    const root = createRepoRoot();
    rmSync(join(root, 'content/notion'), { recursive: true, force: true });
    symlinkSync(join(root, 'content/nowhere'), join(root, 'content/notion'));

    assert.throws(() => resolveRequestedFiles(['content/notion/posts/a.md'], root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // ディレクトリごと記事を消すのは正常な差分。sync はそれをそのまま渡してくる
  test('ディレクトリごと消えた記事は対象外にする', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/live.md');
    writeFileSync(article, frontmatter, 'utf8');

    const resolved = resolveRequestedFiles(['content/posts/gone-dir/a.md', article], root);

    assert.deepEqual(resolved.files, [article]);
    assert.deepEqual(resolved.dropped, ['content/posts/gone-dir/a.md']);
    rmSync(root, { recursive: true, force: true });
  });

  // 置き場所そのものに届かない。記事が消えたのではない
  test('置き場所が実体を失った symlink のとき消えたものと扱わない', () => {
    const root = createRepoRoot();
    rmSync(join(root, 'content/notion/posts'), { recursive: true, force: true });
    symlinkSync(join(root, 'content/nowhere'), join(root, 'content/notion/posts'));

    assert.throws(() => resolveRequestedFiles(['content/notion/posts/a.md'], root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 親がディレクトリでないのは削除ではない。個別指定だけが「記事が消えている」と
  // 報告すると、--all の診断と原因の帰属がずれる
  test('親がディレクトリでない記事を消えたものと扱わない', () => {
    const root = createRepoRoot();
    // notion/posts があるべき場所が通常ファイル
    rmSync(join(root, 'content/notion/posts'), { recursive: true, force: true });
    writeFileSync(join(root, 'content/notion/posts'), '', 'utf8');

    assert.throws(() => resolveRequestedFiles(['content/notion/posts/a.md'], root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 対象外にするだけだが、なぜ落としたかは知らせる。--all は中の記事を拾うので警告しない
  test('手書きツリーの md という名前のディレクトリは対象外にすることを知らせる', () => {
    const root = createRepoRoot();
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    const fake = join(root, 'content/posts/fake.md');
    mkdirSync(fake, { recursive: true });

    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);
    let resolved;
    try {
      resolved = resolveRequestedFiles([fake], root);
    } finally {
      console.warn = original;
    }

    assert.deepEqual(resolved.files, []);
    assert.deepEqual(resolved.dropped, [fake]);
    assert.ok(
      warnings.some((warning) => warning.includes('手書きツリーに記事の名前のディレクトリがある')),
      `警告が出ていない: ${warnings.join(' / ')}`,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 列挙 (listArticleFiles) が手書きツリーを止めない以上、ここで止めると経路差になる
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

  // 呼び出し側は別リポジトリから渡すため、symlink を経た形になりうる
  // (macOS の /var → /private/var など)。字句で比べると全件が対象外になる
  test('symlink を経たパスでも対象にする', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');
    const link = join(dirname(root), `${basename(root)}-link`);
    symlinkSync(root, link);

    try {
      const resolved = resolveRequestedFiles([join(link, 'content/notion/posts/a.md')], root);

      assert.equal(resolved.files.length, 1);
      assert.deepEqual(resolved.dropped, []);
    } finally {
      rmSync(link, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
  });

  // 同じ実体を2つの形で渡されうる。2件とも残すと assertUniqueTargets が
  // slug の重複として全体を落とし、原因を取り違えさせる
  test('同じ実体を指す入力は1件に畳む', () => {
    const root = createRepoRoot();
    const article = join(root, 'content/notion/posts/a.md');
    writeFileSync(article, frontmatter, 'utf8');
    const link = join(dirname(root), `${basename(root)}-dup`);
    symlinkSync(root, link);

    try {
      const resolved = resolveRequestedFiles([article, join(link, 'content/notion/posts/a.md')], root);

      // 先に渡された形を返す。後勝ちだとリポジトリ外を指すパスが残りうる
      assert.deepEqual(resolved.files, [article]);
    } finally {
      rmSync(link, { force: true });
      rmSync(root, { recursive: true, force: true });
    }
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

  // 呼び出し側は files の要素で所属を引く。キーが渡された形のままだと引けず、
  // 実体の解決をやり直すことになる
  test('所属は返すパスで引ける', () => {
    const root = createRepoRoot();
    const filePath = join(root, 'content/notion/posts/a.md');
    writeFileSync(filePath, frontmatter, 'utf8');

    const resolved = resolveRequestedFiles(['content/notion/posts/a.md'], root);

    assert.deepEqual(resolved.files, [filePath]);
    assert.equal(resolved.inSyncOutputOf.get(resolved.files[0]), true);
    rmSync(root, { recursive: true, force: true });
  });

  // 対象外にしたパスも呼び出し側がツリー別に数える
  test('対象外にしたパスでも所属を引ける', () => {
    const root = createRepoRoot();

    const resolved = resolveRequestedFiles(['content/notion/tags.json'], root);

    assert.deepEqual(resolved.dropped, ['content/notion/tags.json']);
    assert.equal(resolved.inSyncOutputOf.get('content/notion/tags.json'), false);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('assertRequestResolved', () => {
  // 誤った cwd で起動すると、範囲は字句で解決されるためパスは範囲内に見えたまま
  // 全件が不在になる。ここを通すと記事だけ同期され OG画像が欠けたまま公開される。
  // 呼び出し側は削除された記事を渡さない (収集が --diff-filter=d で除く)
  test('渡した記事が全件対象外なら失敗させる', () => {
    assert.throws(
      () =>
        assertRequestResolved(['content/notion/posts/gone.md'], {
          files: [],
          dropped: ['content/notion/posts/gone.md'],
          outOfScope: [],
          inSyncOutputOf: new Map(),
        }),
      /すべて対象外/,
    );
  });

  // 基準がずれると範囲の外を指す。記事は同期され OG画像だけが欠けたまま公開される
  test('範囲外の記事があれば失敗させる', () => {
    assert.throws(
      () =>
        assertRequestResolved(['posts/a.md'], {
          files: [],
          dropped: ['posts/a.md'],
          outOfScope: ['posts/a.md'],
          inSyncOutputOf: new Map(),
        }),
      /基準/,
    );
  });

  // 一部が範囲外でも見逃さない。残りが描かれるので全件の判定では捕まらない
  test('一部が範囲外でも失敗させる', () => {
    assert.throws(
      () =>
        assertRequestResolved(['content/notion/posts/a.md', 'posts/b.md'], {
          files: ['content/notion/posts/a.md'],
          dropped: ['posts/b.md'],
          outOfScope: ['posts/b.md'],
          inSyncOutputOf: new Map(),
        }),
      /基準/,
    );
  });

  // 呼び出し側が渡したパスの基準 (blog-content.config.yaml の postsDir) と
  // このツールが見るディレクトリがずれると、全件が対象外になって黙って何も生成されなくなる
  // 範囲の外を指していれば基準のずれである。content/old のような別のツリーが該当する
  test('別のツリーを指していれば失敗する', () => {
    assert.throws(
      () =>
        assertRequestResolved(['content/old/posts/a.md'], {
          files: [],
          dropped: ['content/old/posts/a.md'],
          outOfScope: ['content/old/posts/a.md'],
          inSyncOutputOf: new Map(),
        }),
      /基準/,
    );
  });

  // 一部が対象外になるのは正常に起こる。ここを締めると通常の同期が落ちる
  test('1件でも対象があれば通す', () => {
    assert.doesNotThrow(() =>
      assertRequestResolved(['content/notion/posts/a.md', 'content/notion/tags.json'], {
        files: ['/repo/content/notion/posts/a.md'],
        dropped: ['content/notion/tags.json'],
        outOfScope: [],
        inSyncOutputOf: new Map(),
      }),
    );
  });

  // tags.json だけ、という同期は正常である
  test('記事以外しか渡されていなければ通す', () => {
    assert.doesNotThrow(() =>
      assertRequestResolved(['content/notion/tags.json'], {
        files: [],
        dropped: ['content/notion/tags.json'],
        outOfScope: [],
        inSyncOutputOf: new Map(),
      }),
    );
  });

  test('入力が空なら通す', () => {
    assert.doesNotThrow(() =>
      assertRequestResolved([], { files: [], dropped: [], outOfScope: [], inSyncOutputOf: new Map() }),
    );
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
  // sync の出力の異常は --all でも止める。個別指定は throw するのに --all が黙って飛ばすと、
  // 作り直しのときだけ記事が欠ける
  test('notion 配下の md という名前のディレクトリで失敗する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    const dir = join(root, 'linked');
    mkdirSync(dir, { recursive: true });
    symlinkSync(dir, join(root, 'notion/posts/fake.md'));

    await assert.rejects(() => listArticleFiles(root), /ディレクトリがある/);
    rmSync(root, { recursive: true, force: true });
  });

  // 記事の名前でないディレクトリは個別指定が黙って落とす。ここで失敗させると経路差になる
  test('notion 配下の記事でない名前のディレクトリは対象外にする', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    mkdirSync(join(root, 'notion/posts/images'), { recursive: true });
    writeFileSync(join(root, 'notion/posts/images/b.md'), frontmatter, 'utf8');

    const files = await listArticleFiles(root);

    assert.deepEqual(files, [join(root, 'notion/posts/a.md')]);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーだけが残っていると記事が0件にならず、main の0件ガードも通り抜ける
  for (const [name, prepare] of [
    ['ない', (root: string) => rmSync(join(root, 'notion/posts'), { recursive: true, force: true })],
    ['空である', () => {}],
  ] as const) {
    test(`notion の出力が${name}と失敗する`, async () => {
      const root = createContentDir();
      writeFileSync(join(root, 'posts/authored.md'), frontmatter, 'utf8');
      prepare(root);

      await assert.rejects(() => listArticleFiles(root), /記事が1件もない/);
      rmSync(root, { recursive: true, force: true });
    });
  }

  // その先がディレクトリだったなら中の記事ごと消える。ただし種別は分からないので、
  // 記事と無関係な壊れた symlink 1件で生成全体を落とさない
  test('実体を失った symlink は対象外にすることを知らせる', async () => {
    const root = createContentDir();
    const synced = join(root, 'notion/posts/synced.md');
    writeFileSync(synced, frontmatter, 'utf8');
    symlinkSync(join(root, 'nowhere'), join(root, 'posts/sub'));
    const warnings: string[] = [];
    const original = console.warn;
    console.warn = (message: string) => warnings.push(message);

    let files;
    try {
      files = await listArticleFiles(root);
    } finally {
      console.warn = original;
    }

    assert.deepEqual(files, [synced]);
    assert.ok(
      warnings.some((warning) => warning.includes('sub')),
      `警告が出ていない: ${warnings.join(' / ')}`,
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 実体を失った symlink でも readdir は ENOENT を返す。不在と同じ扱いにすると、
  // ツリーの記事が丸ごと落ちたまま警告なしで成功する
  test('手書きツリーの根が実体を失った symlink なら失敗する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/synced.md'), frontmatter, 'utf8');
    rmSync(join(root, 'posts'), { recursive: true, force: true });
    symlinkSync(join(root, 'nowhere'), join(root, 'posts'));

    await assert.rejects(() => listArticleFiles(root), /記事の置き場所を読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 「記事が1件もない」はチェックアウトの誤りを疑わせる文面であり、原因の帰属が変わる
  test('sync の出力の根が実体を失った symlink なら置き場所の問題として報告する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'posts/authored.md'), frontmatter, 'utf8');
    rmSync(join(root, 'notion/posts'), { recursive: true, force: true });
    symlinkSync(join(root, 'nowhere'), join(root, 'notion/posts'));

    await assert.rejects(() => listArticleFiles(root), /記事の置き場所を読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 1件の不備ではなく、そのツリーの記事が丸ごと落ちる。緑のまま何も生成しないのを防ぐ
  test('手書きツリーの根が読めないと失敗する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/synced.md'), frontmatter, 'utf8');
    rmSync(join(root, 'posts'), { recursive: true, force: true });
    writeFileSync(join(root, 'posts'), '', 'utf8');

    await assert.rejects(() => listArticleFiles(root), /記事の置き場所を読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 内を指す symlink があっても、実体の側で同じ記事を拾うので取りこぼさない
  test('ツリーの内を指す symlink の中の記事は実体の側で拾う', async () => {
    const root = createContentDir();
    const synced = join(root, 'notion/posts/synced.md');
    writeFileSync(synced, frontmatter, 'utf8');
    mkdirSync(join(root, 'posts/2024'), { recursive: true });
    const article = join(root, 'posts/2024/x.md');
    writeFileSync(article, frontmatter, 'utf8');
    symlinkSync(join(root, 'posts/2024'), join(root, 'posts/link'));

    const files = await listArticleFiles(root);

    assert.deepEqual(files.sort(), [synced, article].sort());
    rmSync(root, { recursive: true, force: true });
  });

  // 読めないディレクトリで列挙を中断すると、その後に見つかるはずだった異常が消える
  test('読めないディレクトリがあっても他の異常を報告する', async () => {
    const root = createContentDir();
    mkdirSync(join(root, 'notion/posts/fake.md'), { recursive: true });
    // 手書きツリーがあるべき場所が通常ファイル。readdir が ENOTDIR で失敗する。
    // 権限に依らないので root で実行しても成立する
    rmSync(join(root, 'posts'), { recursive: true, force: true });
    writeFileSync(join(root, 'posts'), '', 'utf8');
    const original = console.warn;
    console.warn = () => {};

    try {
      // 列挙が片方で失敗しても、もう片方で見つけた異常は報告される
      await assert.rejects(
        () => listArticleFiles(root),
        (error: Error) => /ディレクトリがある/.test(error.message) && /記事の置き場所を読めない/.test(error.message),
      );
    } finally {
      console.warn = original;
    }
    rmSync(root, { recursive: true, force: true });
  });

  // 再帰の途中で中断すると、見つかる順によって報告される異常が変わる。
  // root は権限を無視して readdir に成功するため、この検査は成立しない
  test(
    '再帰の途中で読めないディレクトリがあっても最後まで歩く',
    { skip: typeof process.getuid !== 'function' || process.getuid() === 0 },
    async () => {
      const root = createContentDir();
      writeFileSync(join(root, 'notion/posts/synced.md'), frontmatter, 'utf8');
      // 列挙の順に依らないよう、読めないディレクトリを記事の前後どちらにも置く
      for (const name of ['a-locked', 'z-locked']) {
        mkdirSync(join(root, `posts/${name}`), { recursive: true });
        chmodSync(join(root, `posts/${name}`), 0o000);
      }
      try {
        // 読めないディレクトリは1件の不備ではない。その下の記事が丸ごと落ちる
        await assert.rejects(
          () => listArticleFiles(root),
          (error: Error) => error.message.includes('a-locked') && error.message.includes('z-locked'),
        );
      } finally {
        for (const name of ['a-locked', 'z-locked']) {
          chmodSync(join(root, `posts/${name}`), 0o755);
        }
      }
      rmSync(root, { recursive: true, force: true });
    },
  );

  // symlink でなく実体のディレクトリでも同じ。dirent の種別だけで振り分けると取りこぼす
  test('notion 配下の md という名前の実体のディレクトリで失敗する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    mkdirSync(join(root, 'notion/posts/fake.md'), { recursive: true });

    await assert.rejects(() => listArticleFiles(root), /ディレクトリがある/);
    rmSync(root, { recursive: true, force: true });
  });

  // `*.md` という名前のディレクトリでも中は再帰する。個別指定なら中の記事は対象になるので、
  // ここで止めると作り直しのときだけ記事が欠ける
  test('手書きツリーの md という名前のディレクトリの中も拾う', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/synced.md'), frontmatter, 'utf8');
    writeFileSync(join(root, 'posts/real.md'), frontmatter, 'utf8');
    mkdirSync(join(root, 'posts/fake.md'), { recursive: true });
    writeFileSync(join(root, 'posts/fake.md/nested.md'), frontmatter, 'utf8');

    const files = await listArticleFiles(root);

    assert.deepEqual(
      files.sort(),
      [join(root, 'notion/posts/synced.md'), join(root, 'posts/fake.md/nested.md'), join(root, 'posts/real.md')].sort(),
    );
    rmSync(root, { recursive: true, force: true });
  });

  // 実体を失った symlink は読み込みで ENOENT になり、記事の不備でないため全体が止まる
  test('notion 配下の実体を失った記事で失敗する', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/a.md'), frontmatter, 'utf8');
    symlinkSync(join(root, 'missing-target.md'), join(root, 'notion/posts/broken.md'));

    await assert.rejects(() => listArticleFiles(root), /読めない/);
    rmSync(root, { recursive: true, force: true });
  });

  // 手書きツリーの不備1件で生成全体を止めない。個別指定も同じ扱いにする
  test('手書きツリーの実体を失った記事は対象外にする', async () => {
    const root = createContentDir();
    const synced = join(root, 'notion/posts/synced.md');
    writeFileSync(synced, frontmatter, 'utf8');
    writeFileSync(join(root, 'posts/real.md'), frontmatter, 'utf8');
    symlinkSync(join(root, 'missing-target.md'), join(root, 'posts/broken.md'));

    const files = await listArticleFiles(root);

    assert.deepEqual(files.sort(), [synced, join(root, 'posts/real.md')].sort());
    rmSync(root, { recursive: true, force: true });
  });

  // `*.md` という名前のディレクトリ symlink を記事扱いすると EISDIR で全体が止まる。
  // 個別指定でも対象外にしており、経路で扱いを変えない
  test('md という名前のディレクトリ symlink は記事にしない', async () => {
    const root = createContentDir();
    writeFileSync(join(root, 'notion/posts/synced.md'), frontmatter, 'utf8');
    writeFileSync(join(root, 'posts/real.md'), frontmatter, 'utf8');
    const dir = join(root, 'linked');
    mkdirSync(dir, { recursive: true });
    symlinkSync(dir, join(root, 'posts/fake.md'));

    const files = await listArticleFiles(root);

    assert.deepEqual(files, [join(root, 'notion/posts/synced.md'), join(root, 'posts/real.md')]);
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

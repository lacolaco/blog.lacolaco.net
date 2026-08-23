import { strict as assert } from 'node:assert';
import { test, describe, type TestContext } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPORT_FILE } from './report.ts';

/**
 * 呼び出し側 (blog-contents) は報告と実際の枚数を突き合わせる。
 * 報告が前の回のまま残っていると、今回1枚も描かなかった回を見逃す。
 * ここでは配線の順序だけを見る (書き出しそのものは report.spec.ts が見る)。
 */
describe('main の報告', () => {
  const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
  const mainPath = join(repoRoot, 'tools/og-image-sync/main.ts');

  /** 未公開の記事。描画には進まないが、出力先の作り直しは通る */
  const draftFrontmatter = [
    '---',
    "title: 'draft'",
    "slug: 'draft'",
    "created_time: '2026-01-01T00:00:00.000Z'",
    'published: false',
    '---',
    '',
  ].join('\n');

  /**
   * 作業場所。実行は cwd を基準にする。
   *
   * 公開済みの記事は置かない。ここにはレンダラのソースが無く、描画まで進むと
   * 指紋の算出が落ちて、確かめたいことと無関係な理由で失敗する
   */
  function createRoot(t: TestContext): string {
    const root = mkdtempSync(join(tmpdir(), 'og-main-'));
    // 落ちた回にも消す。残すと tmpdir に溜まり続ける
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(join(root, 'content/notion/posts'), { recursive: true });
    mkdirSync(join(root, dirname(REPORT_FILE)), { recursive: true });
    writeFileSync(join(root, REPORT_FILE), '{"rendered":999}\n', 'utf8');
    return root;
  }

  // 素の node は .tsx を読めない。package.json の og-image-sync と同じく tsx で起動する。
  // npx にすると cwd が tmp のため固定した版が解決されず、レジストリから別の版を取る
  const tsxPath = join(repoRoot, 'node_modules/.bin/tsx');

  function run(root: string, args: string[]): { status: number | null; stderr: string } {
    const result = spawnSync(tsxPath, [mainPath, ...args], { cwd: root, encoding: 'utf8' });
    return { status: result.status, stderr: result.stderr };
  }

  // 引数の解釈より後に消していると、この回で前回の数が残る
  test('引数が不正でも前回の報告を残さない', (t: TestContext) => {
    const root = createRoot(t);

    const { status, stderr } = run(root, ['--all', 'content/notion/posts/draft.md']);

    // 別の理由で落ちても通らないよう、弾いた理由まで見る
    assert.notEqual(status, 0);
    assert.match(stderr, /--all と記事のパスは同時に指定できない/);
    assert.equal(existsSync(join(root, REPORT_FILE)), false, '前回の報告が残っている');
  });

  // 手書きツリーの記事が混ざったかを報告できないと、呼び出し側は「--all だったか」を
  // 覚えて判断することになり、規則が二重に置かれる
  test('手書きツリーの記事を数える', (t: TestContext) => {
    const root = createRoot(t);
    mkdirSync(join(root, 'content/posts'), { recursive: true });
    writeFileSync(join(root, 'content/posts/draft.md'), draftFrontmatter, 'utf8');
    writeFileSync(join(root, 'content/notion/posts/draft.md'), draftFrontmatter, 'utf8');

    const { status, stderr } = run(root, ['content/posts/draft.md', 'content/notion/posts/draft.md']);

    assert.equal(status, 0, stderr);
    const report = JSON.parse(readFileSync(join(root, REPORT_FILE), 'utf8')) as {
      sync: { targeted: number };
      authored: { targeted: number };
    };
    assert.equal(report.sync.targeted, 1);
    assert.equal(report.authored.targeted, 1);
  });

  // 対象を渡された回は出力先を作り直しているので、枚数を突き合わせてよい。
  // 描画そのものは指紋の算出でリポジトリのソースを読むため、ここでは通らない。
  // 作り直す経路だけを、未公開の記事で確かめる
  test('対象を渡された回は作り直したことを報告する', (t: TestContext) => {
    const root = createRoot(t);
    writeFileSync(join(root, 'content/notion/posts/draft.md'), draftFrontmatter, 'utf8');

    const { status, stderr } = run(root, ['content/notion/posts/draft.md']);

    assert.equal(status, 0, stderr);
    // 受け取ったのに描かれなかったことが、報告だけで分かる。
    // 数える場所も報告が持つので、呼び出し側が組み立てなくてよい
    assert.deepEqual(JSON.parse(readFileSync(join(root, REPORT_FILE), 'utf8')), {
      // 未公開だから描かれなかった、とツリーごとに分かる
      sync: { targeted: 1, droppedArticles: 0, skipped: { unpublished: 1, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 0,
      staged: true,
      // macOS の /var は /private/var への symlink なので、実体で比べる
      outputDir: join(realpathSync(root), '.tmp/og-staging/og'),
      // 送る場所も報告が持つ。呼び出し側に親から求めさせない
      stagingDir: join(realpathSync(root), '.tmp/og-staging'),
    });
  });
});

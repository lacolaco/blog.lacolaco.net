import { strict as assert } from 'node:assert';
import { test, describe, type TestContext } from 'node:test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import {
  REPORT_FILE,
  buildEmptyRenderReport,
  buildRenderReport,
  buildTreeReport,
  clearRenderReport,
  writeRenderReport,
} from './report.ts';
import { STAGING_DIR } from './paths.ts';

describe('buildTreeReport', () => {
  const noSkips = { unpublished: 0, notAnArticle: 0, invalid: 0 };

  test('受け取った件数を数える', () => {
    assert.equal(buildTreeReport(3, [], noSkips).targeted, 3);
  });

  // 記事でない入力の混入は正常に毎回起こる。数に混ぜると異常が埋もれる
  test('対象外にした数は記事だけを数える', () => {
    const report = buildTreeReport(0, ['content/notion/tags.json', 'content/notion/posts/gone.md'], noSkips);

    assert.equal(report.droppedArticles, 1);
  });

  // 未公開 (正常) と記述の不備 (異常) を同じ数にまとめると、静かな欠落を見分けられない
  test('描かなかった理由を分けて載せる', () => {
    const skipped = { unpublished: 1, notAnArticle: 1, invalid: 1 };

    assert.deepEqual(buildTreeReport(1, [], skipped).skipped, skipped);
  });
});

describe('buildRenderReport', () => {
  const empty = { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } };

  // ツリーをまとめると、手書きが混ざった回に sync の出力の異常まで見逃す
  test('ツリーごとに分けて載せる', () => {
    const sync = { ...empty, targeted: 2 };
    const authored = { ...empty, targeted: 1, skipped: { unpublished: 1, notAnArticle: 0, invalid: 0 } };

    const report = buildRenderReport({ sync, authored, rendered: 2, outputDir: '/tmp/og' });

    assert.deepEqual(report.sync, sync);
    assert.deepEqual(report.authored, authored);
    assert.equal(report.rendered, 2);
  });

  // 描いた回は必ず出力先を作り直している。偽で報告すると突き合わせが行われない
  test('作り直したことを常に報告する', () => {
    const report = buildRenderReport({ sync: empty, authored: empty, rendered: 0, outputDir: '/tmp/og' });

    assert.equal(report.staged, true);
    assert.equal(report.outputDir, '/tmp/og');
  });

  // 描くものが無い回は数える場所を持たない。空文字だと相対パスとして別の場所を数えうる
  test('作り直していない回は数える場所を持たない', () => {
    assert.deepEqual(buildEmptyRenderReport(), {
      sync: empty,
      authored: empty,
      rendered: 0,
      staged: false,
      outputDir: null,
    });
  });
});

describe('render report', () => {
  function createRoot(t: TestContext): string {
    const root = mkdtempSync(join(tmpdir(), 'og-report-'));
    // 落ちた回にも消す。残すと tmpdir に溜まり続ける
    t.after(() => rmSync(root, { recursive: true, force: true }));
    return root;
  }

  /** 呼び出し側は数として読む。読み取りの型をここで閉じる */
  function readReport(root: string): Record<string, unknown> {
    return JSON.parse(readFileSync(join(root, REPORT_FILE), 'utf8')) as Record<string, unknown>;
  }

  // 呼び出し側 (blog-contents) は描かれた枚数を知る術がなく、描く規則を複製すると
  // 公開判定や記事の不備の扱いで必ずずれる。数はこちらが報告する
  test('描いた枚数を読み取れる形で残す', (t: TestContext) => {
    const root = createRoot(t);

    writeRenderReport(root, {
      sync: { targeted: 3, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 3,
      staged: true,
      outputDir: '/tmp/og',
    });

    assert.deepEqual(readReport(root), {
      sync: { targeted: 3, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 3,
      staged: true,
      outputDir: '/tmp/og',
    });
  });

  // アップロードされるのは staging の中身である。中に置くと R2 に混ざる
  test('アップロードされる場所には置かない', () => {
    // 前方一致だと `.tmp/og-staging-x` のような別の場所を中と誤判定する
    const outside = relative(STAGING_DIR, REPORT_FILE);
    assert.ok(outside.startsWith('..'), `${REPORT_FILE} が ${STAGING_DIR} の中にある。R2 へ送られてしまう`);
  });

  // 前回の回の数が残っていると、今回1枚も描かなかった回を見逃す
  test('前回の報告を消せる', (t: TestContext) => {
    const root = createRoot(t);
    writeRenderReport(root, {
      sync: { targeted: 5, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 5,
      staged: true,
      outputDir: '/tmp/og',
    });

    clearRenderReport(root);

    assert.equal(existsSync(join(root, REPORT_FILE)), false);
  });

  // 消す対象が無い回も普通にある (初回、あるいは対象なしで終わった直後)
  test('報告が無くても消せる', (t: TestContext) => {
    const root = createRoot(t);

    assert.doesNotThrow(() => clearRenderReport(root));
  });

  // 置き場所ごと無い状態から呼ばれる。書けずに落ちると生成そのものが失敗する
  test('置き場所が無くても書ける', (t: TestContext) => {
    const root = createRoot(t);
    rmSync(join(root, dirname(REPORT_FILE)), { recursive: true, force: true });

    writeRenderReport(root, {
      sync: { targeted: 1, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 1,
      staged: true,
      outputDir: '/tmp/og',
    });

    assert.equal(existsSync(join(root, REPORT_FILE)), true);
  });

  // 前の回の報告が長いと、上書きで末尾が残って壊れた JSON になる
  test('前の回の報告に上書きしても読める', (t: TestContext) => {
    const root = createRoot(t);
    writeRenderReport(root, {
      sync: { targeted: 123456, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 123456,
      staged: true,
      outputDir: '/tmp/og',
    });

    writeRenderReport(root, {
      sync: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 0,
      staged: false,
      outputDir: '/tmp/og',
    });

    assert.deepEqual(readReport(root), {
      sync: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      authored: { targeted: 0, droppedArticles: 0, skipped: { unpublished: 0, notAnArticle: 0, invalid: 0 } },
      rendered: 0,
      staged: false,
      outputDir: '/tmp/og',
    });
  });
});

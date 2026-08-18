import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { spawnSync } from 'node:child_process';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { OUTPUT_DIR, STAGING_DIR, prepareStaging } from './paths.ts';
import { OG_OUTPUT_DIR_NAME } from './discover.ts';

/** テストの実行位置に依存しないよう、このファイルからリポジトリルートを求める */
const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function isGitIgnored(path: string): boolean {
  // --no-index は付けない。付けるとルールだけを見るため、`git add -f` で追跡下に入った
  // 生成物を見逃す。守りたいのは「生成のたびに差分が出てPRに載らない」ことである
  const result = spawnSync('git', ['check-ignore', '--quiet', path], { cwd: repoRoot });
  // 0 は ignore、1 は非 ignore。それ以外は git が無い・リポジトリでないなどの別の失敗で、
  // 「ignore されていない」と混同すると原因を取り違える
  if (result.status === 0) {
    return true;
  }
  if (result.status === 1) {
    return false;
  }
  throw new Error(`git check-ignore を実行できない: ${result.error?.message ?? `exit ${String(result.status)}`}`);
}

describe('出力先', () => {
  // git 管理下に置くと、生成のたびに差分が出てPRに載る。
  // 位置ではなく実際の ignore を引く。.gitignore は変わるものである
  test('staging は git 管理から外れている', () => {
    assert.equal(isGitIgnored(STAGING_DIR), true);
  });

  // アップロード側 (blog-contents の .github/actions/og-images) はこの値を持っている。
  // 変えると向こうが空のディレクトリを読むことになるので、リテラルで固定する
  test('staging のパスはアップロード側と一致する', () => {
    assert.equal(STAGING_DIR, '.tmp/og-staging');
  });

  // r2-sync は sourceDir からの相対パスをそのままキーにする。
  // 末尾がこの名前だからキーが `og/<file>` になる
  test('出力先の末尾はR2キーの接頭辞と一致する', () => {
    const segments = OUTPUT_DIR.split(sep);
    assert.equal(segments[segments.length - 1], OG_OUTPUT_DIR_NAME);
  });
});

describe('prepareStaging', () => {
  // アップロード側に渡すのは外側。内側を渡すとキーが og/ を失う
  test('外側と内側の両方を返す', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'og-staging-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    const { stagingDir, outputDir } = await prepareStaging(root);

    assert.equal(stagingDir, join(root, STAGING_DIR));
    assert.equal(outputDir, join(root, OUTPUT_DIR));
  });

  test('出力先を作る', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'og-staging-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    const { outputDir } = await prepareStaging(root);

    assert.equal(existsSync(outputDir), true);
  });

  // ここはそのままアップロードされる集合なので、残すと今回描いていない画像まで送られる
  test('前回の出力を残さない', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'og-staging-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    const { outputDir } = await prepareStaging(root);
    writeFileSync(join(outputDir, 'stale.png'), 'x', 'utf8');
    // staging の直下に落ちた残骸も消す
    writeFileSync(join(root, STAGING_DIR, 'stray.png'), 'x', 'utf8');

    await prepareStaging(root);

    assert.equal(existsSync(join(outputDir, 'stale.png')), false);
    assert.equal(existsSync(join(root, STAGING_DIR, 'stray.png')), false);
  });

  // 初回や、掃除済みのチェックアウトでも落ちない
  test('出力先が無くても落ちない', async (t) => {
    const root = mkdtempSync(join(tmpdir(), 'og-staging-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));

    await assert.doesNotReject(() => prepareStaging(root));
  });
});

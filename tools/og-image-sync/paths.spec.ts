import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { spawnSync } from 'node:child_process';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTPUT_DIR, STAGING_DIR } from './paths.ts';
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

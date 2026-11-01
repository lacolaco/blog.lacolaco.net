import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const script = join(import.meta.dirname, 'remove-revision-tag.sh');
const conflict =
  "ERROR: (gcloud.run.services.update-traffic) ABORTED: Conflict for resource 'web': version 1 was specified but current version is 2.";

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

// 呼び出しごとに responses の先頭から [終了コード, 標準エラー] を返す gcloud のスタブで実行する
function run(responses: [number, string][], maxAttempts = 3) {
  const dir = mkdtempSync(join(tmpdir(), 'gcloud-stub-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'responses.json'), JSON.stringify(responses));
  writeFileSync(
    join(dir, 'gcloud'),
    `#!/usr/bin/env node
const fs = require('fs');
const d = ${JSON.stringify(dir)};
fs.appendFileSync(d + '/calls.log', process.argv.slice(2).join(' ') + '\\n');
const res = JSON.parse(fs.readFileSync(d + '/responses.json', 'utf8'));
const n = fs.existsSync(d + '/calls.log') ? fs.readFileSync(d + '/calls.log', 'utf8').trim().split('\\n').length : 1;
const [code, err] = res[Math.min(n, res.length) - 1];
if (err) process.stderr.write(err + '\\n');
process.exit(code);
`,
  );
  chmodSync(join(dir, 'gcloud'), 0o755);
  const result = spawnSync('bash', [script, '2141'], {
    env: {
      ...process.env,
      PATH: `${dir}:${process.env.PATH}`,
      MAX_ATTEMPTS: String(maxAttempts),
      RETRY_DELAY_SECONDS: '0',
    },
    encoding: 'utf8',
  });
  const calls = readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n');
  return { status: result.status, calls };
}

describe('remove-revision-tag.sh', () => {
  it('初回で成功したら再試行せず成功する', () => {
    const { status, calls } = run([[0, '']]);
    assert.equal(status, 0);
    assert.deepEqual(calls, ['run services update-traffic web --region asia-northeast1 --remove-tags pr-2141']);
  });

  it('競合 (ABORTED) の後の再試行で成功したら成功する', () => {
    const { status, calls } = run([
      [1, conflict],
      [1, conflict],
      [0, ''],
    ]);
    assert.equal(status, 0);
    assert.equal(calls.length, 3);
  });

  it('規定の回数まで競合が続いたら、その回数で止めて失敗する', () => {
    const { status, calls } = run([[1, conflict]], 4);
    assert.notEqual(status, 0);
    assert.equal(calls.length, 4);
  });

  it('競合以外の失敗は再試行せず失敗する', () => {
    const { status, calls } = run([[1, 'ERROR: (gcloud.run.services.update-traffic) PERMISSION_DENIED: denied']]);
    assert.notEqual(status, 0);
    assert.equal(calls.length, 1);
  });
});

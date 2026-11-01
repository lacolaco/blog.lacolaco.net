import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, it } from 'node:test';

const dirOfScripts = import.meta.dirname;

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true });
});

type Stub = {
  // `gcloud run services list` が返すサービス名
  services?: string[];
  // `gcloud run services delete <名前>` の結果 (名前 → [終了コード, 標準エラー])。無ければ成功
  deleteResults?: Record<string, [number, string]>;
  // `gh pr list` が返す開いている PR の番号と終了コード
  openPrs?: number[];
  ghExit?: number;
};

// gcloud と gh のスタブを PATH の先頭に置いてスクリプトを実行し、gcloud の呼び出しを返す
function run(script: string, args: string[], stub: Stub) {
  const dir = mkdtempSync(join(tmpdir(), 'cli-stub-'));
  dirs.push(dir);
  writeFileSync(join(dir, 'stub.json'), JSON.stringify(stub));
  const body = (tool: string) => `#!/usr/bin/env node
const fs = require('fs');
const d = ${JSON.stringify(dir)};
const stub = JSON.parse(fs.readFileSync(d + '/stub.json', 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(d + '/calls.log', '${tool} ' + args.join(' ') + '\\n');
if ('${tool}' === 'gh') {
  if (stub.ghExit) { process.stderr.write('gh failed\\n'); process.exit(stub.ghExit); }
  process.stdout.write((stub.openPrs || []).join('\\n') + '\\n');
  process.exit(0);
}
if (args[2] === 'list') { process.stdout.write((stub.services || []).join('\\n') + '\\n'); process.exit(0); }
if (args[2] === 'delete') {
  const [code, err] = (stub.deleteResults || {})[args[3]] || [0, ''];
  if (err) process.stderr.write(err + '\\n');
  process.exit(code);
}
process.exit(0);
`;
  for (const tool of ['gcloud', 'gh']) {
    writeFileSync(join(dir, tool), body(tool));
    chmodSync(join(dir, tool), 0o755);
  }
  const result = spawnSync('bash', [join(dirOfScripts, script), ...args], {
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
    encoding: 'utf8',
  });
  let calls: string[] = [];
  try {
    calls = readFileSync(join(dir, 'calls.log'), 'utf8').trim().split('\n');
  } catch {
    // 呼び出しが無かった
  }
  return { status: result.status, calls, stderr: result.stderr };
}

const deleteCall = (n: number) => `gcloud run services delete web-pr-${n} --region asia-northeast1 --quiet`;

describe('delete-preview-service.sh', () => {
  it('PR 番号のプレビュー用サービスだけを削除し、本番の web には触れない', () => {
    const { status, calls } = run('delete-preview-service.sh', ['2141'], {});
    assert.equal(status, 0);
    assert.deepEqual(calls, [deleteCall(2141)]);
  });

  it('サービスがすでに無ければ成功する (デプロイが Cloud Run まで進まなかった PR)', () => {
    const { status } = run('delete-preview-service.sh', ['2141'], {
      deleteResults: {
        'web-pr-2141': [1, 'ERROR: (gcloud.run.services.delete) Service [web-pr-2141] could not be found.'],
      },
    });
    assert.equal(status, 0);
  });

  it('権限などそれ以外の失敗は失敗として終える', () => {
    const { status, stderr } = run('delete-preview-service.sh', ['2141'], {
      deleteResults: { 'web-pr-2141': [1, 'ERROR: PERMISSION_DENIED'] },
    });
    assert.equal(status, 1);
    assert.match(stderr, /PERMISSION_DENIED/);
  });

  it('PR 番号が数字でなければ gcloud を呼ばずに失敗する', () => {
    const { status, calls } = run('delete-preview-service.sh', ['web'], {});
    assert.notEqual(status, 0);
    assert.deepEqual(calls, []);
  });
});

describe('sweep-preview-services.sh', () => {
  it('開いていない PR のプレビュー用サービスだけを削除する', () => {
    const { status, calls } = run('sweep-preview-services.sh', [], {
      services: ['web-pr-10', 'web-pr-11', 'web-pr-12'],
      openPrs: [11],
    });
    assert.equal(status, 0);
    assert.deepEqual(
      calls.filter((c) => c.includes(' delete ')),
      [deleteCall(10), deleteCall(12)],
    );
  });

  it('プレビューの名前の形でないサービス (本番の web など) は、開いている PR が無くても削除しない', () => {
    const { status, calls } = run('sweep-preview-services.sh', [], {
      services: ['web', 'blog-og-image', 'web-pr-abc', 'web-pr-10'],
      openPrs: [],
    });
    assert.equal(status, 0);
    assert.deepEqual(
      calls.filter((c) => c.includes(' delete ')),
      [deleteCall(10)],
    );
  });

  it('開いている PR の一覧を取れなければ、何も削除せず失敗する', () => {
    const { status, calls } = run('sweep-preview-services.sh', [], {
      services: ['web-pr-10'],
      ghExit: 1,
    });
    assert.notEqual(status, 0);
    assert.deepEqual(
      calls.filter((c) => c.includes(' delete ')),
      [],
    );
  });

  it('1件の削除に失敗しても残りを削除し、最後に失敗で終える', () => {
    const { status, calls } = run('sweep-preview-services.sh', [], {
      services: ['web-pr-10', 'web-pr-12'],
      openPrs: [],
      deleteResults: { 'web-pr-10': [1, 'ERROR: PERMISSION_DENIED'] },
    });
    assert.notEqual(status, 0);
    assert.deepEqual(
      calls.filter((c) => c.includes(' delete ')),
      [deleteCall(10), deleteCall(12)],
    );
  });

  it('一覧は preview ラベルのサービスに絞って取得する', () => {
    const { calls } = run('sweep-preview-services.sh', [], { services: [], openPrs: [] });
    assert.ok(calls.some((c) => c.startsWith('gcloud run services list') && c.includes('labels.purpose=preview')));
  });
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

// 積み重ねた PR (base が main でない PR) でも CI とコードレビューを実行しつつ、
// 本番への操作と自動マージは base が main の PR だけに限る、というワークフローの構成を検証する。
// ワークフローの YAML を直接読むので、ビルドは要らない。

const workflowsDir = new URL('../../.github/workflows/', import.meta.url);

type Step = {
  id?: string;
  name?: string;
  if?: string;
  run?: string;
  uses?: string;
  'continue-on-error'?: boolean;
  env?: Record<string, string>;
};
type Job = { if?: string; steps?: Step[] };
type Workflow = {
  on: {
    pull_request?: { branches?: string[]; 'branches-ignore'?: string[]; types?: string[] };
    push?: { branches?: string[] };
    workflow_dispatch?: unknown;
  };
  jobs: Record<string, Job>;
};

function load(file: string): Workflow {
  return parse(readFileSync(new URL(file, workflowsDir), 'utf8')) as Workflow;
}

// --- GitHub Actions の式 (if 条件で使う範囲) を評価する最小の評価器 ---
// 対応: コンテキストの参照、文字列、true/false、!、==、!=、&&、||、括弧

type Ctx = Record<string, string | boolean>;

function evaluate(expression: string, ctx: Ctx): unknown {
  const source = expression.trim().replace(/^\$\{\{([\s\S]*)\}\}$/, '$1');
  const tokens = source.match(/'[^']*'|&&|\|\||==|!=|[!()]|[A-Za-z_][\w.-]*/g) ?? [];
  assert.equal(tokens.join(''), source.replace(/\s+/g, ''), `式を字句に分けきれない: ${source}`);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  const primary = (): unknown => {
    const t = next();
    if (t === '!') return !truthy(primary());
    if (t === '(') {
      const v = or();
      assert.equal(next(), ')');
      return v;
    }
    if (t.startsWith("'")) return t.slice(1, -1);
    if (t === 'true') return true;
    if (t === 'false') return false;
    return ctx[t] ?? '';
  };
  const equality = (): unknown => {
    let left = primary();
    while (peek() === '==' || peek() === '!=') {
      const op = next();
      const right = primary();
      // GitHub の式は文字列の比較で大文字小文字を区別しない
      const eq = String(left).toLowerCase() === String(right).toLowerCase();
      left = op === '==' ? eq : !eq;
    }
    return left;
  };
  const and = (): unknown => {
    let left = equality();
    while (peek() === '&&') {
      next();
      const right = equality();
      left = truthy(left) ? right : left;
    }
    return left;
  };
  const or = (): unknown => {
    let left = and();
    while (peek() === '||') {
      next();
      const right = and();
      left = truthy(left) ? left : right;
    }
    return left;
  };
  const result = or();
  assert.equal(pos, tokens.length, `式を最後まで読めない: ${source}`);
  return result;
}

const truthy = (v: unknown) => v !== '' && v !== false && v !== 0 && v !== null && v !== undefined;

describe('評価器の自己検査', () => {
  it('&& と || の優先順位、否定、括弧を扱う', () => {
    assert.equal(evaluate("a == 'x' || b == 'y' && c == 'z'", { a: 'x', b: 'y', c: 'n' }), true);
    assert.equal(evaluate("(a == 'x' || b == 'y') && c == 'z'", { a: 'x', b: 'y', c: 'n' }), false);
    assert.equal(evaluate('!d', { d: false }), true);
    assert.equal(evaluate('${{ !d }}', { d: true }), false);
  });
});

// --- 起動条件 ---

describe('ci.yml と code-review.yml の起動条件', () => {
  for (const file of ['ci.yml', 'code-review.yml']) {
    it(`${file}: pull_request が base のブランチを限らない`, () => {
      const pr = load(file).on.pull_request;
      assert.ok(pr, 'pull_request で起動する');
      assert.equal(pr.branches, undefined);
      assert.equal(pr['branches-ignore'], undefined);
    });

    it(`${file}: 起動する種類は draft の解除まで含む`, () => {
      assert.deepEqual(load(file).on.pull_request?.types, ['opened', 'synchronize', 'reopened', 'ready_for_review']);
    });
  }
});

describe('preview の配備と片付けの起動範囲', () => {
  it('deploy-preview.yml は base のブランチを限らない', () => {
    const pr = load('deploy-preview.yml').on.pull_request;
    assert.ok(pr);
    assert.equal(pr.branches, undefined);
    assert.equal(pr['branches-ignore'], undefined);
  });

  it('shutdown-preview.yml の base の範囲は deploy-preview.yml と同じ', () => {
    const deploy = load('deploy-preview.yml').on.pull_request;
    const shutdown = load('shutdown-preview.yml').on.pull_request;
    assert.ok(deploy && shutdown);
    assert.deepEqual(shutdown.branches, deploy.branches);
    assert.deepEqual(shutdown['branches-ignore'], deploy['branches-ignore']);
  });
});

// --- 本番への操作 ---

describe('本番への操作は main への push だけで起動する', () => {
  const files = readdirSync(workflowsDir).filter((f) => f.endsWith('.yml'));

  it('terraform apply は deploy-production.yml にだけある', () => {
    const withApply = files.filter((file) =>
      Object.values(load(file).jobs).some((job) => job.steps?.some((s) => /terraform\s+apply/.test(s.run ?? ''))),
    );
    assert.deepEqual(withApply, ['deploy-production.yml']);
  });

  it('deploy-production.yml は pull_request で起動せず、push は main だけ', () => {
    const on = load('deploy-production.yml').on;
    assert.equal(on.pull_request, undefined);
    assert.deepEqual(on.push?.branches, ['main']);
  });
});

// --- 自動マージ ---

describe('ci.yml の auto-merge', () => {
  const condition = load('ci.yml').jobs['auto-merge'].if;
  assert.ok(condition, 'auto-merge に if 条件がある');

  // 全ての条件が自動マージを許す入力。ここから 1 つずつ崩して分岐を確かめる
  const base: Ctx = {
    'github.event.pull_request.base.ref': 'main',
    'github.event.pull_request.draft': false,
    'github.head_ref': 'feature/x',
    'needs.ok.result': 'success',
    'needs.renovate-review.result': 'skipped',
    'needs.content-review.result': 'success',
    'needs.classify.outputs.code_changed': 'false',
    // !cancelled() は関数呼び出しなので、評価器では真偽値の変数として扱う
    'always-not-cancelled': true,
  };
  // 評価器は関数呼び出しを扱わないので、!cancelled() を除いた式で評価する
  const expr = condition.replace('!cancelled()', 'always-not-cancelled');
  const run = (over: Ctx) => truthy(evaluate(expr, { ...base, ...over }));

  const NOT_MAIN = { 'github.event.pull_request.base.ref': 'feature/stack-parent' };

  it('base が main で content-review が成功し、コード変更がなければマージする', () => {
    assert.equal(run({}), true);
  });
  it('base が main の renovate PR は renovate-review の成功でマージする', () => {
    assert.equal(
      run({
        'needs.renovate-review.result': 'success',
        'needs.content-review.result': 'skipped',
        'needs.classify.outputs.code_changed': 'true',
      }),
      true,
    );
  });
  it('base が main の auto-translate PR はマージする', () => {
    assert.equal(run({ 'github.head_ref': 'auto-translate', 'needs.content-review.result': 'skipped' }), true);
  });
  it('base が main でコード変更を含む PR はマージしない', () => {
    assert.equal(run({ 'needs.classify.outputs.code_changed': 'true' }), false);
  });
  it('base が main でも draft や ok の失敗ではマージしない', () => {
    assert.equal(run({ 'github.event.pull_request.draft': true }), false);
    assert.equal(run({ 'needs.ok.result': 'failure' }), false);
  });

  // base が main でない PR は、マージ可能に見える全ての経路でも実行しない
  it('base が main でない PR は、content だけの変更でもマージしない', () => {
    assert.equal(run(NOT_MAIN), false);
  });
  it('base が main でない renovate PR はマージしない', () => {
    assert.equal(
      run({
        ...NOT_MAIN,
        'needs.renovate-review.result': 'success',
        'needs.content-review.result': 'skipped',
        'needs.classify.outputs.code_changed': 'true',
      }),
      false,
    );
  });
  it('base が main でない auto-translate PR はマージしない', () => {
    assert.equal(
      run({ ...NOT_MAIN, 'github.head_ref': 'auto-translate', 'needs.content-review.result': 'skipped' }),
      false,
    );
  });
});

// --- Terraform の plan ---

describe('ci.yml の Terraform plan', () => {
  const plan = load('ci.yml').jobs.terraform.steps?.find((s) => s.name === 'Terraform Plan');

  it('plan のステップがある', () => {
    assert.ok(plan);
  });

  // 積み重ねた PR の plan が、別の PR の plan や main の apply と state のロックを取り合わないようにする。
  // main 向けの PR の plan は従来どおりロックを取る。
  it('base が main でない PR だけ、state のロックを取らない', () => {
    assert.ok(plan?.run?.includes('$LOCK_ARGS'), 'plan に LOCK_ARGS を渡す');
    const lockArgs = plan?.env?.LOCK_ARGS;
    assert.ok(lockArgs);
    const onMain = evaluate(lockArgs, { 'github.event.pull_request.base.ref': 'main' });
    const onStack = evaluate(lockArgs, { 'github.event.pull_request.base.ref': 'feature/stack-parent' });
    assert.equal(onMain, '');
    assert.equal(onStack, '-lock=false');
  });
});

// --- Cloud Run の共有サービス web への書き込みの競合 ---
//
// preview の配備、片付けのタグ削除、本番のデプロイは、いずれも共有サービス web を
// 読み出して書き戻す。同時に実行されると、後から書く側が
// "ABORTED: Conflict for resource 'web'" で失敗する。
// ABORTED は個々のリクエストでなく、読み出しからの一連の操作ごとやり直すエラーである
// (https://google.aip.dev/194)。GitHub の concurrency group を全 PR で共通にすると、
// 待機中の実行が最新の 1 件を残して取り消されるので、やり直しで対処する。

describe('片付けのタグ削除は web の更新の競合でやり直す', () => {
  const step = load('shutdown-preview.yml').jobs['shutdown-preview'].steps?.find((s) =>
    s.run?.includes('update-traffic'),
  );

  // 偽の gcloud と sleep を PATH の先頭に置き、step の run をそのまま実行する。
  // gcloud は呼び出しごとに results の次の行 (ABORTED / OTHER / OK) を返す。
  function runStep(results: ('ABORTED' | 'OTHER' | 'OK')[]) {
    assert.ok(step?.run, 'update-traffic を呼ぶ step がある');
    const dir = mkdtempSync(join(tmpdir(), 'shutdown-'));
    writeFileSync(join(dir, 'results'), results.join('\n') + '\n');
    writeFileSync(
      join(dir, 'gcloud'),
      `#!/bin/bash
echo "$@" >> "${dir}/calls"
n=$(wc -l < "${dir}/calls")
r=$(sed -n "$n"p "${dir}/results")
case "$r" in
  OK) exit 0 ;;
  ABORTED) echo "ERROR: (gcloud.run.services.update-traffic) ABORTED: Conflict for resource 'web'" >&2; exit 1 ;;
  *) echo "ERROR: (gcloud.run.services.update-traffic) PERMISSION_DENIED" >&2; exit 1 ;;
esac
`,
    );
    writeFileSync(join(dir, 'sleep'), '#!/bin/bash\nexit 0\n');
    chmodSync(join(dir, 'gcloud'), 0o755);
    chmodSync(join(dir, 'sleep'), 0o755);
    const script = step.run.split('${{ github.event.number }}').join('42');
    const r = spawnSync('bash', ['-eo', 'pipefail', '-c', script], {
      env: { ...process.env, PATH: `${dir}:${process.env.PATH}` },
      encoding: 'utf8',
    });
    const callsFile = join(dir, 'calls');
    const calls = existsSync(callsFile) ? readFileSync(callsFile, 'utf8').trim().split('\n') : [];
    return { status: r.status, calls };
  }

  it('競合なしなら 1 回で成功し、PR のタグを削除する', () => {
    const r = runStep(['OK']);
    assert.equal(r.status, 0);
    assert.equal(r.calls.length, 1);
    assert.match(r.calls[0], /--remove-tags pr-42/);
  });
  it('ABORTED が続いてもやり直して成功する', () => {
    const r = runStep(['ABORTED', 'ABORTED', 'OK']);
    assert.equal(r.status, 0);
    assert.equal(r.calls.length, 3);
  });
  it('ABORTED 以外のエラーはやり直さず失敗する', () => {
    const r = runStep(['OTHER', 'OK']);
    assert.notEqual(r.status, 0);
    assert.equal(r.calls.length, 1);
  });
  it('ABORTED が回数の上限まで続いたら失敗する', () => {
    const r = runStep(Array.from({ length: 10 }, () => 'ABORTED' as const));
    assert.notEqual(r.status, 0);
    assert.equal(r.calls.length, 5);
  });
});

describe('deploy-cloudrun アクションは web の更新の競合でやり直す', () => {
  const action = parse(
    readFileSync(new URL('../../.github/actions/deploy-cloudrun/action.yml', import.meta.url), 'utf8'),
  ) as {
    outputs: { url: { value: string } };
    runs: { steps: Step[] };
  };
  const steps = action.runs.steps;
  const first = steps.find((s) => s.id === 'deploy');
  const retry = steps.find((s) => s.id === 'deploy-retry');
  const ctx = (outcome: string): Ctx => ({ 'steps.deploy.outcome': outcome });

  it('最初の配備は失敗しても step を止めない', () => {
    assert.ok(first?.uses?.startsWith('google-github-actions/deploy-cloudrun@'));
    assert.equal(first['continue-on-error'], true);
  });
  it('最初の配備が失敗したときだけ、待ってから同じ配備をやり直す', () => {
    assert.ok(retry?.uses?.startsWith('google-github-actions/deploy-cloudrun@'));
    assert.equal(truthy(evaluate(retry.if ?? 'false', ctx('failure'))), true);
    assert.equal(truthy(evaluate(retry.if ?? 'false', ctx('success'))), false);
    const wait = steps[steps.indexOf(retry) - 1];
    assert.equal(truthy(evaluate(wait.if ?? 'false', ctx('failure'))), true);
    assert.equal(truthy(evaluate(wait.if ?? 'false', ctx('success'))), false);
    assert.match(wait.run ?? '', /sleep/);
  });
  it('やり直しの入力は最初の配備と同じ', () => {
    assert.deepEqual((retry as unknown as { with: unknown }).with, (first as unknown as { with: unknown }).with);
  });
  it('出力の url は、やり直した配備があればその値、なければ最初の配備の値', () => {
    const value = action.outputs.url.value;
    const run = (c: Ctx) => evaluate(value, c);
    assert.equal(run({ 'steps.deploy.outputs.url': 'A', 'steps.deploy-retry.outputs.url': '' }), 'A');
    assert.equal(run({ 'steps.deploy.outputs.url': '', 'steps.deploy-retry.outputs.url': 'B' }), 'B');
  });
});

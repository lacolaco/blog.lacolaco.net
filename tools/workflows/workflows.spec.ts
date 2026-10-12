import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { parse } from 'yaml';

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

describe('ci.yml の auto-merge', () => {
  const condition = load('ci.yml').jobs['auto-merge'].if;
  assert.ok(condition, 'auto-merge に if 条件がある');

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

describe('ci.yml の Terraform plan', () => {
  const plan = load('ci.yml').jobs.terraform.steps?.find((s) => s.name === 'Terraform Plan');

  it('plan のステップがある', () => {
    assert.ok(plan);
  });

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

describe('web に書き込む 3 ジョブは同じ group で直列に実行する', () => {
  type Concurrency = { group?: string; queue?: string; 'cancel-in-progress'?: boolean };
  const writers = [
    ['deploy-preview.yml', 'deploy'],
    ['deploy-production.yml', 'deploy'],
    ['shutdown-preview.yml', 'shutdown-preview'],
  ] as const;
  const concurrencyOf = (file: string, job: string): Concurrency | undefined =>
    (load(file).jobs[job] as Job & { concurrency?: Concurrency }).concurrency;

  for (const [file, job] of writers) {
    it(`${file} の ${job} は group cloud-run-web に queue: max で入り、cancel-in-progress を付けない`, () => {
      assert.deepEqual(concurrencyOf(file, job), { group: 'cloud-run-web', queue: 'max' });
    });
  }

  it('やり直しの仕組みを持たない', () => {
    const shutdown = load('shutdown-preview.yml').jobs['shutdown-preview'].steps ?? [];
    const tagStep = shutdown.find((s) => s.run?.includes('update-traffic'));
    assert.ok(tagStep?.run);
    assert.ok(!/ABORTED|for attempt|sleep/.test(tagStep.run));
    const action = parse(
      readFileSync(new URL('../../.github/actions/deploy-cloudrun/action.yml', import.meta.url), 'utf8'),
    ) as { outputs: { url: { value: string } }; runs: { steps: Step[] } };
    const steps = action.runs.steps;
    assert.equal(steps.filter((s) => s.uses?.startsWith('google-github-actions/deploy-cloudrun@')).length, 1);
    assert.ok(steps.every((s) => !('continue-on-error' in s)));
    assert.ok(!action.outputs.url.value.includes('deploy-retry'));
  });
});

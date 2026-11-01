import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const script = join(import.meta.dirname, 'protect-cloud-run-tags.sh');

function run(input: unknown) {
  const result = spawnSync('bash', [script], {
    input: typeof input === 'string' ? input : JSON.stringify(input),
    encoding: 'utf-8',
  });
  return { status: result.status, stderr: result.stderr };
}
const bash = (command: string) => ({ tool_name: 'Bash', tool_input: { command } });

describe('protect-cloud-run-tags', () => {
  describe('止める', () => {
    for (const command of [
      'gcloud run services update-traffic web --set-tags=foo=rev-1 --region=asia-northeast1',
      'gcloud run services update-traffic web --set-tags foo=rev-1',
      'gcloud run services update-traffic web --set-tags="a=b"',
      'gcloud run services update-traffic web "--set-tags=a=b"',
      'gcloud run services update-traffic web "--set-tags" a=b',
      'echo x && gcloud run services update-traffic web "--set-tags=a=b"',
      'git commit -m "x"\ngcloud run services update-traffic web "--set-tags=a=b"',
      'echo hi\nbash -c "gcloud run services update-traffic web --set-tags=a=b"',
      'bash -c "gcloud run services update-traffic web --set-tags=a=b"',
      "sh -c 'gcloud run services update-traffic web --set-tags=a=b'",
      'ssh host "gcloud run services update-traffic web --set-tags=a=b"',
      'eval "gcloud run services update-traffic web --set-tags=a=b"',
      "gcloud run services update-traffic web --set-tags 'a=b'",
      'gcloud --project=p run services update-traffic web --region=r --set-tags=foo=rev-1',
      'echo start && gcloud run services update-traffic web --set-tags=a=b',
      'gcloud run services update-traffic web \\\n  --set-tags=a=b',
      'gcloud run services \\\n  update-traffic web --set-tags=a=b',
      'gcloud run services update-traffic web\n--set-tags=a=b',
    ]) {
      it(command, () => {
        const { status, stderr } = run(bash(command));
        assert.equal(status, 2);
        assert.match(stderr, /--update-tags/);
        assert.match(stderr, /--remove-tags/);
      });
    }
  });

  describe('止めない', () => {
    for (const command of [
      'gcloud run services update-traffic web --update-tags=foo=rev-1',
      'gcloud run services update-traffic web --remove-tags=foo',
      'gcloud run services update-traffic web --to-latest',
      'gcloud run services update web --set-tags=foo=rev-1',
      'gcloud run services describe web',
      'git commit -m "gcloud run services update-traffic で --set-tags を使わない"',
      "git commit -m 'gcloud run services update-traffic で --set-tags を使わない'",
      'echo "gcloud run services update-traffic --set-tags"',
      'git commit -m "update-traffic で --set-tags を使わない" -m \'gcloud run services\'',
      'ls -la',
    ]) {
      it(command, () => {
        assert.equal(run(bash(command)).status, 0);
      });
    }

    it('command が無い入力', () => {
      assert.equal(run({ tool_name: 'Bash', tool_input: {} }).status, 0);
    });

    it('JSON でない入力 (フック側の異常は許可する)', () => {
      assert.equal(run('not json').status, 0);
    });
  });

  it('.claude/settings.json が Bash の PreToolUse に登録している', () => {
    type Settings = { hooks: { PreToolUse: { matcher: string; hooks: { command: string }[] }[] } };
    const settings = JSON.parse(
      readFileSync(join(import.meta.dirname, '../../.claude/settings.json'), 'utf-8'),
    ) as Settings;
    const entry = settings.hooks.PreToolUse.find((e) => e.matcher === 'Bash');
    assert.ok(entry);
    assert.ok(entry.hooks.some((h) => h.command.endsWith('tools/protect-cloud-run-tags/protect-cloud-run-tags.sh')));
  });
});

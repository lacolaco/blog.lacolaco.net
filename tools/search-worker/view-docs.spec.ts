// search_events ビューの列の説明 (Terraform の schema) と README の列の表が、ビューの SQL の列と食い違わないことを確かめる。
// ソースを直接読むので、ビルドも BigQuery の認証も要らない。
// 説明の中身 (列の意味) は文章なので機械では確かめられない。ここで守るのは、列を足し引きしたときに
// 説明と README のどちらかが取り残されないことである。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf-8');

/** ビューの SQL の最も外側の SELECT の列名 */
function sqlColumns(): string[] {
  const sql = read('infra/terraform/search_events.sql.tftpl');
  const m = sql.match(/^SELECT ([^\n]+)\nFROM \(/m);
  assert.ok(m, 'search_events.sql.tftpl の最も外側の SELECT が見つからない');
  return m[1].split(',').map((c) => c.trim());
}

/** Terraform の search_events リソースの schema に書いた列 (名前と説明) */
function schemaColumns(): { name: string; description: string }[] {
  const tf = read('infra/terraform/search_logs.tf');
  const block = tf.match(/resource "google_bigquery_table" "search_events" \{[\s\S]*?\n\}\n/);
  assert.ok(block, 'search_events のリソースが見つからない');
  const schema = block[0].match(/schema = jsonencode\(\[([\s\S]*?)\n  \]\)/);
  assert.ok(schema, 'search_events に schema (列の説明) が無い');
  return [...schema[1].matchAll(/name = "(\w+)"[^\n]*?description = "((?:[^"\\]|\\.)*)"/g)].map((m) => ({
    name: m[1],
    description: m[2],
  }));
}

/** README の「ビューの列」の表の列名 */
function readmeColumns(): string[] {
  const md = read('infra/README.md');
  const section = md.match(/### ビューの列\n([\s\S]*?)\n### /);
  assert.ok(section, 'README に「ビューの列」の見出しが無い');
  return [...section[1].matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
}

describe('search_events の列の説明', () => {
  it('SQL の全列に、空でない説明が Terraform の schema にある', () => {
    const cols = schemaColumns();
    assert.deepEqual(
      cols.map((c) => c.name),
      sqlColumns(),
    );
    for (const c of cols) assert.ok(c.description.trim().length > 0, `${c.name} の説明が空`);
  });

  it('README の列の表が、SQL の全列を同じ順に載せている', () => {
    assert.deepEqual(readmeColumns(), sqlColumns());
  });
});

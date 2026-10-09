// search_events と search_log_quality の列の説明 (Terraform の schema) と README の列の表が、ビューの SQL の列と食い違わないことを確かめる。
// ソースを直接読むので、ビルドも BigQuery の認証も要らない。
// 説明の中身 (列の意味) は文章なので機械では確かめられない。ここで守るのは、列を足し引きしたときに
// 説明と README のどちらかが取り残されないことである。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf-8');

interface ViewSpec {
  /** ビューの名前 (Terraform のリソース名、SQL ファイル名、README の見出し以外の識別に使う) */
  name: string;
  /** SQL の最も外側の SELECT の列名 */
  sqlColumns: () => string[];
  /** README で列を載せた表の列名 (表の順) */
  readmeColumns: () => string[];
}

/** Terraform のビューのリソースの schema に書いた列 (名前と説明) */
function schemaColumns(view: string): { name: string; description: string }[] {
  const tf = read('infra/terraform/search_logs.tf');
  const block = tf.match(new RegExp(`resource "google_bigquery_table" "${view}" \\{[\\s\\S]*?\\n\\}\\n`));
  assert.ok(block, `${view} のリソースが見つからない`);
  const schema = block[0].match(/schema = jsonencode\(\[([\s\S]*?)\n {2}\]\)/);
  assert.ok(schema, `${view} に schema (列の説明) が無い`);
  return [...schema[1].matchAll(/name = "(\w+)"[^\n]*?description = "((?:[^"\\]|\\.)*)"/g)].map((m) => ({
    name: m[1],
    description: m[2],
  }));
}

const views: ViewSpec[] = [
  {
    name: 'search_events',
    sqlColumns: () => {
      const sql = read('infra/terraform/search_events.sql.tftpl');
      const m = sql.match(/^SELECT ([^\n]+)\nFROM \(/m);
      assert.ok(m, 'search_events.sql.tftpl の最も外側の SELECT が見つからない');
      return m[1].split(',').map((c) => c.trim());
    },
    // 「ビューの列」の表
    readmeColumns: () => {
      const md = read('infra/README.md');
      const section = md.match(/### ビューの列\n([\s\S]*?)\n### /);
      assert.ok(section, 'README に「ビューの列」の見出しが無い');
      return [...section[1].matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
    },
  },
  {
    name: 'search_log_quality',
    // 最も外側の SELECT は複数行 (CASE を含む)。項目は 2 字下げの行で、列名は `AS 名前` か行頭の名前
    sqlColumns: () => {
      const sql = read('infra/terraform/search_log_quality.sql.tftpl');
      const m = sql.match(/^\)\nSELECT\n([\s\S]*?)\nFROM per_run/m);
      assert.ok(m, 'search_log_quality.sql.tftpl の最も外側の SELECT が見つからない');
      return [...m[1].matchAll(/^ {2}(?:[^\n]*\bAS |(?=\w+,$))(\w+),?$/gm)].map((c) => c[1]);
    },
    // 「取りこぼしの割合」の最初の表 (列の表)。reason の値の表 (見出しが「意味」) より前だけを読む
    readmeColumns: () => {
      const md = read('infra/README.md');
      const section = md.match(/### 取りこぼしの割合\n([\s\S]*?)\n\| `reason` \| 意味/);
      assert.ok(section, 'README に「取りこぼしの割合」の列の表が無い');
      return [...section[1].matchAll(/^\| `(\w+)` \|/gm)].map((m) => m[1]);
    },
  },
];

for (const view of views) {
  describe(`${view.name} の列の説明`, () => {
    it('SQL の全列に、空でない説明が Terraform の schema にある', () => {
      const cols = schemaColumns(view.name);
      assert.deepEqual(
        cols.map((c) => c.name),
        view.sqlColumns(),
      );
      for (const c of cols) assert.ok(c.description.trim().length > 0, `${c.name} の説明が空`);
    });

    it('README の列の表が、SQL の全列を同じ順に載せている', () => {
      assert.deepEqual(view.readmeColumns(), view.sqlColumns());
    });
  });
}

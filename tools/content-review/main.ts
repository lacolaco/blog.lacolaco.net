/**
 * content-review が NG のときに PR へ投稿するコメント本文を stdout に出す。
 *
 * 入力 (env):
 *   REVIEW_RESULT  claude-code-action の structured_output (JSON)
 *   OWNER          メンション先の GitHub ユーザー名
 * cwd はリポジトリルート (manifest.json と指摘ファイルを読む)
 */
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';
import { splitFrontmatter } from '../auto-translate/translator.ts';
import { formatNgComment, type Entry, type Issue } from './format.ts';
import { classifyProvenance, jaSourceOf, notionUrlOf } from './provenance.ts';

const reviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(z.object({ file: z.string(), description: z.string() })),
});

const manifestSchema = z.record(z.object({ filePath: z.string().optional() }).passthrough());

function notionSyncPaths(manifestPath = 'manifest.json'): Set<string> {
  if (!existsSync(manifestPath)) return new Set();
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(manifestPath, 'utf-8')));
  return new Set(
    Object.values(manifest)
      .map((entry) => entry.filePath)
      .filter((p): p is string => p !== undefined),
  );
}

function toEntry(path: string, inManifest: boolean): Entry | undefined {
  if (!path.endsWith('.md') || !existsSync(path)) return undefined;

  const { frontmatter } = splitFrontmatter(readFileSync(path, 'utf-8'));
  const provenance = classifyProvenance({ frontmatter, inManifest });
  const jaSource = jaSourceOf(path);

  return {
    path,
    provenance,
    notionUrl: provenance === 'notion-sync' ? notionUrlOf(frontmatter) : undefined,
    jaSource: provenance === 'auto-translated' && existsSync(jaSource) ? jaSource : undefined,
  };
}

function main(): void {
  const { summary, issues } = reviewResultSchema.parse(JSON.parse(process.env.REVIEW_RESULT ?? ''));
  const owner = process.env.OWNER ?? '';
  const paths = notionSyncPaths();

  const entries = [...new Set(issues.map((i: Issue) => i.file))]
    .sort()
    .map((path) => toEntry(path, paths.has(path)))
    .filter((entry): entry is Entry => entry !== undefined);

  process.stdout.write(formatNgComment({ owner, summary, issues, entries }));
}

main();

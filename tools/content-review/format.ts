import type { Provenance } from './provenance.ts';

export interface Issue {
  file: string;
  description: string;
}

export interface Entry {
  path: string;
  provenance: Provenance;
  /** notion-sync 由来のときの Notion 原稿 URL */
  notionUrl?: string;
  /** auto-translated のときの翻訳元 ja ファイル (存在する場合のみ) */
  jaSource?: string;
}

export interface NgCommentInput {
  owner: string;
  summary: string;
  issues: Issue[];
  entries: Entry[];
}

export function formatNgComment({ owner, summary, issues, entries }: NgCommentInput): string {
  const notion = entries.filter((e) => e.provenance === 'notion-sync');
  const translated = entries.filter((e) => e.provenance === 'auto-translated');
  const direct = entries.filter((e) => e.provenance === 'direct');

  const sections = [
    [`## コンテンツレビュー NG`, ``, `@${owner} 修正が必要です。`, ``, summary].join('\n'),
    issues.map((i) => `- **${i.file}**: ${i.description}`).join('\n'),
  ];

  if (notion.length > 0) {
    sections.push(
      [
        `### Notion 原稿を修正`,
        ``,
        ...notion.map((e) => `- \`${e.path}\`: ${e.notionUrl ?? '(notion_url なし)'}`),
        ``,
        `原稿を修正すると sync でこの PR が更新されます。`,
      ].join('\n'),
    );
  }

  if (translated.length > 0) {
    sections.push(
      [
        `### auto-translate 生成物`,
        ``,
        ...translated.map((e) => (e.jaSource ? `- \`${e.path}\` (翻訳元: \`${e.jaSource}\`)` : `- \`${e.path}\``)),
        ``,
        `翻訳文の誤りは tools/auto-translate/ のパイプライン側、ja 原稿由来の誤りは翻訳元の Notion 原稿を修正してください。`,
      ].join('\n'),
    );
  }

  if (direct.length > 0) {
    sections.push(
      [
        `### 直接管理されているファイル`,
        ``,
        ...direct.map((e) => `- \`${e.path}\``),
        ``,
        `生成物ではないため、このファイルを直接修正してください。`,
      ].join('\n'),
    );
  }

  const regenerated = [notion.length > 0 ? 'sync' : null, translated.length > 0 ? 'auto-translate' : null].filter(
    (v) => v !== null,
  );

  if (regenerated.length > 0) {
    sections.push(`生成物を PR 内で直接編集しても、次の ${regenerated.join(' / ')} で上書きされます。`);
  }

  return sections.filter((s) => s.length > 0).join('\n\n') + '\n';
}

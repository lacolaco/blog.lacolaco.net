// 翻訳結果に対する別人格 LLM によるセルフレビュー（校正）モジュール。
// translator は「訳す役」、proofreader は「整合性をチェックする役」と人格を分離する。
// 検出対象: prose と code 識別子の不整合、反転した意味、捏造、欠落、誤った固有名詞。

import { errorMessage } from './ast-utils.ts';

export interface ProofIssue {
  location: string;
  problem: string;
  suggestion: string;
}

export interface ProofResult {
  ok: boolean;
  issues: ProofIssue[];
}

export type ProofreaderClient = (
  input: { jaSource: string; enTranslation: string },
  model: string,
) => Promise<ProofResult>;

export interface ProofreadArgs {
  jaSource: string;
  enTranslation: string;
  client: ProofreaderClient;
  model: string;
}

export async function proofread(args: ProofreadArgs): Promise<ProofResult> {
  try {
    return await args.client({ jaSource: args.jaSource, enTranslation: args.enTranslation }, args.model);
  } catch (e) {
    // proofread はベストエフォート。失敗で翻訳全体を止めると blast radius が大きいため fail open で採用する。
    // ただしログには残す
    console.warn(`[auto-translate] proofreader call failed (treating as ok): ${errorMessage(e)}`);
    return { ok: true, issues: [] };
  }
}

export function formatProofIssues(issues: ProofIssue[]): string {
  if (issues.length === 0) return '';
  const lines = ['Proofreader detected the following issues in the translation:'];
  for (const i of issues) {
    lines.push(`- [${i.location}] ${i.problem}`);
    lines.push(`  suggested fix: ${i.suggestion}`);
  }
  lines.push('');
  // 翻訳者 LLM はコードブロックを直接見ず ⟨⟨BLOCK_N⟩⟩ プレースホルダのみを受け取るため、
  // 「code blocks unchanged」ではなくプレースホルダを明示した指示にする
  lines.push(
    'Please retranslate addressing these issues. Keep all ⟨⟨BLOCK_N⟩⟩ placeholders verbatim and preserve backtick inline code identifiers as-is.',
  );
  return lines.join('\n');
}

import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { extractCode, restoreCode } from './code-extractor.ts';
import { translateCodeBlock, type CodeTranslatorClient } from './code-translator.ts';
import { buildEnFrontmatter, getAutoTranslatedFrom, isAutoTranslated, type Frontmatter } from './frontmatter.ts';
import { proofread, formatProofIssues, type ProofreaderClient } from './proofreader.ts';
import { validateStructure, type ValidationResult } from './structure-validator.ts';

// PROMPT_VERSION: プロンプト/モデル/構造検証ロジックが変わったらインクリメントしてキャッシュを invalidate する。
// バージョン履歴は git log で追える（変更時はコミットメッセージに「PROMPT_VERSION N → N+1」と記載）
export const PROMPT_VERSION = 4;
// preview だが最新世代品質を採用。GEMINI_MODEL env で stable (gemini-2.5-flash 等) に切替可能
// 参考: https://ai.google.dev/gemini-api/docs/models
export const DEFAULT_MODEL = 'gemini-3-flash-preview';
export const MAX_RETRIES = 3;

export interface GeminiInput {
  title: string;
  body: string;
  feedback?: string;
}

export interface GeminiOutput {
  title_en: string;
  body_en: string;
}

export type GeminiClient = (input: GeminiInput, model: string) => Promise<GeminiOutput>;

export interface TranslateOneArgs {
  jaPath: string;
  enPath: string;
  jaContent: string;
  enContent: string | null;
  geminiClient: GeminiClient;
  proofreaderClient: ProofreaderClient;
  codeTranslatorClient: CodeTranslatorClient;
  model: string;
  slug?: string; // ログ識別用。省略時は jaPath の basename を使う
}

export type TranslateResult =
  | { kind: 'translated'; enContent: string }
  | { kind: 'frontmatter-only'; enContent: string }
  | { kind: 'skipped' }
  | { kind: 'failed'; reason: string };

export function computeBodyHash(jaBody: string, jaTitle: string, model: string): string {
  // \x00 区切りで境界を明示し、フィールド間のプレフィックス衝突を防ぐ
  const input = [jaBody, jaTitle, String(PROMPT_VERSION), model].join('\x00');
  return createHash('sha256').update(input).digest('hex');
}

// frontmatter 境界の正規表現。
// 前提: 本ブログ記事の frontmatter では YAML 値内に無インデントの `---` が現れないこと。
// - en ファイル: joinFrontmatter で defaultStringType='QUOTE_SINGLE' で stringify するため成立
// - ja ファイル: notion-sync (@lacolaco/notion-sync) の YAML シリアライズ仕様に依存。
//   現状は string 値が常にクォートされるため成立するが、ライブラリ側の変更で破れうる
// この前提が破れる場合は yaml パッケージの parseDocument 等で frontmatter 境界を明示的に扱う実装に置換すること
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n?\n?([\s\S]*)$/;

export function splitFrontmatter(content: string): { frontmatter: Frontmatter; body: string } {
  const match = FRONTMATTER_RE.exec(content);
  if (!match) throw new Error('Invalid markdown: frontmatter not found');
  const fm = parseYaml(match[1]) as Frontmatter;
  return { frontmatter: fm, body: match[2] };
}

export function joinFrontmatter(frontmatter: Frontmatter, body: string): string {
  const yaml = stringifyYaml(frontmatter, { defaultStringType: 'QUOTE_SINGLE', defaultKeyType: 'PLAIN' });
  return `---\n${yaml}---\n\n${body}`;
}

function buildFeedback(validation: ValidationResult): string {
  const lines = ['The translation has structural mismatches with the source:'];
  let hasBlockquoteCodeIssue = false;
  for (const m of validation.mismatches) {
    if (m.kind === 'blockquoteCodeContent') {
      // count 差異と内容差異で別メッセージにする
      if (m.differKind === 'count') {
        lines.push(
          `- ${m.kind}: a code block inside a blockquote was added or removed (source has ${m.source}, translation has ${m.target}).`,
        );
      } else {
        lines.push(
          `- ${m.kind}: a code block inside a blockquote was modified. The content must remain BYTE-FOR-BYTE identical to the source.`,
        );
      }
      hasBlockquoteCodeIssue = true;
    } else {
      lines.push(`- ${m.kind}: source has ${m.source}, translation has ${m.target}`);
    }
  }
  lines.push('');
  lines.push(
    'Please retranslate ensuring all links, images, and bare URL paragraphs from the source are preserved exactly. Do not omit, merge, or wrap any URL into prose. Each placeholder ⟨⟨BLOCK_N⟩⟩ and ⟨⟨INLINE_N⟩⟩ must appear exactly once in your output, verbatim — do not modify, drop, or duplicate them.',
  );
  if (hasBlockquoteCodeIssue) {
    lines.push(
      'Code blocks inside blockquotes (lines starting with "> ") must be preserved BYTE-FOR-BYTE — do NOT translate their comments and do NOT change any character.',
    );
  }
  return lines.join('\n');
}

const TOTAL_ATTEMPTS = MAX_RETRIES + 1;

function summarizeStructureMismatch(validation: ValidationResult): string {
  return validation.mismatches
    .map((m) => {
      if (m.kind === 'blockquoteCodeContent') {
        // count 同値の場合は数だけだと「ja=2 en=2」と一見問題なく見えるため明示する
        return `${m.kind} (${m.differKind ?? 'differ'}) ja=${m.source} en=${m.target}`;
      }
      return `${m.kind} ja=${m.source} en=${m.target}`;
    })
    .join(', ');
}

type RetryFailureReason =
  | { kind: 'placeholder' } // restoreCode が throw（drop / 重複 / 幻覚）
  | { kind: 'structure' } // structure-validator NG
  | { kind: 'proofread' }; // proofreader NG

async function callWithRetries(
  client: GeminiClient,
  proofreaderClient: ProofreaderClient,
  codeTranslatorClient: CodeTranslatorClient,
  model: string,
  input: { title: string; body: string },
  slug: string,
): Promise<
  | { ok: true; output: GeminiOutput; attempts: number }
  | { ok: false; attempts: number; lastFailure: RetryFailureReason | undefined }
  | { ok: false; attempts: number; thrownAt: number; cause: Error }
> {
  // ja body から code を抽出してプレースホルダ化。LLM には template だけ渡す。
  // 各コードブロックは個別に翻訳（コメントのみ訳す）し、最終的に restoreCode でマージする
  const { template: jaTemplate, codeBlocks, inlineCodes } = extractCode(input.body);

  // 各コードブロックを個別翻訳（コメントのみ）。インラインコードは識別子なので翻訳しない。
  // ブロック間は独立しているため Promise.all で並列化する
  const translatedCodeBlocks = await Promise.all(
    codeBlocks.map((code) => translateCodeBlock({ code, client: codeTranslatorClient, model })),
  );
  if (codeBlocks.length > 0) {
    const translatedCount = translatedCodeBlocks.filter((t, i) => t !== codeBlocks[i]).length;
    if (translatedCount > 0) {
      console.info(
        `[auto-translate] code block comments translated for ${slug}: ${translatedCount}/${codeBlocks.length} blocks`,
      );
    }
  }

  let feedback: string | undefined;
  // lastFailure は最終試行の失敗種別を保持。失敗パスを通る前に return する場合は undefined のまま
  let lastFailure: RetryFailureReason | undefined;
  for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt++) {
    let output: GeminiOutput;
    try {
      // body は jaTemplate（プレースホルダ入り）を渡す
      output = await client({ title: input.title, body: jaTemplate, feedback }, model);
    } catch (e) {
      // 試行中に API がエラー（ネットワーク・5xx・429 等）。試行番号を保持して呼び出し元へ
      return { ok: false, attempts: attempt, thrownAt: attempt, cause: e as Error };
    }

    // 翻訳結果（プレースホルダ入り）を、コメント翻訳済みのコードブロック + インラインコードで復元する
    let restoredBody: string;
    try {
      restoredBody = restoreCode(output.body_en, translatedCodeBlocks, inlineCodes);
    } catch (e) {
      // LLM がプレースホルダを drop / 幻覚した場合に到達。retry で改善する可能性
      lastFailure = { kind: 'placeholder' };
      if (attempt < TOTAL_ATTEMPTS) {
        console.warn(
          `[auto-translate] placeholder restoration failed (attempt ${attempt}/${TOTAL_ATTEMPTS}) for ${slug}: ${(e as Error).message} — retrying`,
        );
        feedback = `Your previous response did not preserve all code placeholders correctly. Each placeholder ⟨⟨BLOCK_N⟩⟩ and ⟨⟨INLINE_N⟩⟩ from the source MUST appear exactly once in your output, in a position that makes sense for the translation. Do not invent new placeholders. Do not omit any.`;
      }
      continue;
    }
    const restoredOutput: GeminiOutput = { title_en: output.title_en, body_en: restoredBody };

    // (1) 構造検証（ローカル、コスト 0）。code は復元済みなので構造一致は trivial に成立する想定。
    // 万一一致しないケース（LLM が prose 中で markdown 構造を破壊した等）への保険として残す
    const validation = validateStructure(input.body, restoredOutput.body_en);
    if (!validation.ok) {
      lastFailure = { kind: 'structure' };
      if (attempt < TOTAL_ATTEMPTS) {
        console.warn(
          `[auto-translate] structure mismatch (attempt ${attempt}/${TOTAL_ATTEMPTS}) for ${slug}: ${summarizeStructureMismatch(validation)} — retrying`,
        );
        feedback = buildFeedback(validation);
      }
      continue;
    }

    // (2) proofread（別人格 LLM、API コール 1 回）。意味・整合性をチェック。
    // 完全な en（code 復元済み）を渡すことで proofreader が prose-code 整合をチェックできる
    const proof = await proofread({
      jaSource: input.body,
      enTranslation: restoredOutput.body_en,
      client: proofreaderClient,
      model,
    });
    // ok と issues のクロスバリデーション:
    // - ok=true: issues があっても accept（proofreader が「許容範囲の指摘」とみなした）
    // - ok=false かつ issues=[]: 不整合な応答。リトライしても feedback が無く改善見込みがないため accept する（fail-open）
    // - ok=false かつ issues 非空: 通常の retry 経路
    if (proof.ok || proof.issues.length === 0) {
      if (!proof.ok) {
        console.warn(
          `[auto-translate] proofreader returned ok=false but no issues for ${slug} — treating as accept (cannot retry without feedback)`,
        );
      }
      if (attempt > 1) {
        console.info(`[auto-translate] translation accepted on attempt ${attempt} for ${slug}`);
      }
      return { ok: true, output: restoredOutput, attempts: attempt };
    }

    lastFailure = { kind: 'proofread' };
    if (attempt < TOTAL_ATTEMPTS) {
      const issuesSummary = proof.issues.map((i) => `[${i.location}] ${i.problem}`).join('; ');
      console.warn(
        `[auto-translate] proofread issues (attempt ${attempt}/${TOTAL_ATTEMPTS}) for ${slug}: ${issuesSummary} — retrying`,
      );
      feedback = formatProofIssues(proof.issues);
    }
    // 最終試行失敗時は呼び出し元（main.ts）で error ログを出すため、ここでは出力しない（重複防止）
  }
  return { ok: false, attempts: TOTAL_ATTEMPTS, lastFailure };
}

export async function translateOne(args: TranslateOneArgs): Promise<TranslateResult> {
  const { jaContent, enContent, geminiClient, proofreaderClient, codeTranslatorClient, model, jaPath } = args;
  const slug = args.slug ?? jaPath.split('/').pop() ?? jaPath;

  let ja: { frontmatter: Frontmatter; body: string };
  try {
    ja = splitFrontmatter(jaContent);
  } catch (e) {
    return { kind: 'failed', reason: `ja frontmatter parse error: ${(e as Error).message}` };
  }

  const jaTitleRaw = ja.frontmatter.title;
  const jaTitle = typeof jaTitleRaw === 'string' ? jaTitleRaw : '';
  const newHash = computeBodyHash(ja.body, jaTitle, model);

  // 既存 en の auto_translated_from を確認（一度だけパースして再利用する）
  let existingEnHash: string | undefined;
  let cachedTranslatedTitle: string | undefined;
  let cachedEnBody: string | undefined;
  if (enContent !== null) {
    let en: { frontmatter: Frontmatter; body: string };
    try {
      en = splitFrontmatter(enContent);
    } catch (e) {
      // パース不能な en が手動翻訳かどうか区別できない。上書きリスクを避け失敗扱い。
      // main.ts は parse-error を事前に検出して translateOne を呼ばないが、defense-in-depth として
      // 直接呼び出された場合にも安全側に倒す
      return { kind: 'failed', reason: `existing en parse error: ${(e as Error).message}` };
    }
    if (isAutoTranslated(en.frontmatter)) {
      existingEnHash = getAutoTranslatedFrom(en.frontmatter);
      const titleRaw = en.frontmatter.title;
      cachedTranslatedTitle = typeof titleRaw === 'string' ? titleRaw : '';
      cachedEnBody = en.body;
    } else {
      // 手動翻訳された en が存在する。本来は呼び出し側 (classifyFile + main.ts) で protect-manual に
      // 分岐され translateOne には到達しないが、defense-in-depth として API を呼ばずに失敗を返す。
      // ここで翻訳を続行すると手動翻訳を無音で上書きしてしまう
      return {
        kind: 'failed',
        reason: 'manual en detected (auto_translated_from missing) — refusing to overwrite',
      };
    }
  }

  // キャッシュヒット: API 呼ばず frontmatter 再構築
  if (existingEnHash === newHash && cachedTranslatedTitle !== undefined && cachedEnBody !== undefined) {
    const newEnFrontmatter = buildEnFrontmatter({
      jaFrontmatter: ja.frontmatter,
      translatedTitle: cachedTranslatedTitle,
      bodyHash: newHash,
    });
    const newEnContent = joinFrontmatter(newEnFrontmatter, cachedEnBody);
    if (newEnContent === enContent) {
      return { kind: 'skipped' };
    }
    return { kind: 'frontmatter-only', enContent: newEnContent };
  }

  // API 呼ぶ（リトライ込み）。callWithRetries は API 例外を内部 catch して outcome に変換するため、
  // ここでの try-catch は予期せぬ例外（実装バグ等）の保険のみ
  let outcome: Awaited<ReturnType<typeof callWithRetries>>;
  try {
    outcome = await callWithRetries(
      geminiClient,
      proofreaderClient,
      codeTranslatorClient,
      model,
      { title: jaTitle, body: ja.body },
      slug,
    );
  } catch (e) {
    return { kind: 'failed', reason: `unexpected error: ${(e as Error).message}` };
  }

  if (!outcome.ok) {
    if ('thrownAt' in outcome) {
      return {
        kind: 'failed',
        reason: `Gemini API error on attempt ${outcome.thrownAt}/${TOTAL_ATTEMPTS}: ${outcome.cause.message}`,
      };
    }
    const lastReason = (() => {
      if (!outcome.lastFailure) return 'unknown failure';
      const kind = outcome.lastFailure.kind;
      switch (kind) {
        case 'placeholder':
          return 'placeholder restoration failed';
        case 'structure':
          return 'structure validation failed';
        case 'proofread':
          return 'proofread issues';
        default: {
          // 新しい kind が増えた場合に型エラーで気づくための exhaustive check
          const _exhaustive: never = kind;
          throw new Error(`Unhandled RetryFailureReason kind: ${String(_exhaustive)}`);
        }
      }
    })();
    return {
      kind: 'failed',
      reason: `${lastReason} persisted after ${outcome.attempts} attempts, keeping existing .en.md`,
    };
  }

  const enFrontmatter = buildEnFrontmatter({
    jaFrontmatter: ja.frontmatter,
    translatedTitle: outcome.output.title_en,
    bodyHash: newHash,
  });
  const enFullContent = joinFrontmatter(enFrontmatter, outcome.output.body_en);
  return { kind: 'translated', enContent: enFullContent };
}

import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { buildEnFrontmatter, getAutoTranslatedFrom, isAutoTranslated, type Frontmatter } from './frontmatter.ts';
import { validateStructure, type ValidationResult } from './structure-validator.ts';

export const PROMPT_VERSION = 3;
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
// 前提: joinFrontmatter で常に defaultStringType='QUOTE_SINGLE' で stringify するため、
//       YAML 値内に無インデントの `---` が現れない。stringifyYaml オプションを変更する際は
//       この前提が破れないか確認すること（破れる場合は yaml パッケージの parseDocument に置換）
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
  for (const m of validation.mismatches) {
    lines.push(`- ${m.kind}: source has ${m.source}, translation has ${m.target}`);
  }
  lines.push('');
  lines.push(
    'Please retranslate ensuring all code blocks, links, images, and bare URL paragraphs from the source are preserved exactly. Do not omit, merge, or wrap any URL into prose.',
  );
  return lines.join('\n');
}

const TOTAL_ATTEMPTS = MAX_RETRIES + 1;

async function callWithRetries(
  client: GeminiClient,
  model: string,
  input: { title: string; body: string },
  slug: string,
): Promise<
  | { ok: true; output: GeminiOutput; attempts: number }
  | { ok: false; attempts: number }
  | { ok: false; attempts: number; thrownAt: number; cause: Error }
> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= TOTAL_ATTEMPTS; attempt++) {
    let output: GeminiOutput;
    try {
      output = await client({ title: input.title, body: input.body, feedback }, model);
    } catch (e) {
      // 試行中に API がエラー（ネットワーク・5xx・429 等）。試行番号を保持して呼び出し元へ
      return { ok: false, attempts: attempt, thrownAt: attempt, cause: e as Error };
    }
    const validation = validateStructure(input.body, output.body_en);
    if (validation.ok) {
      if (attempt > 1) {
        console.info(`[auto-translate] structure validation passed on attempt ${attempt} for ${slug}`);
      }
      return { ok: true, output, attempts: attempt };
    }
    if (attempt < TOTAL_ATTEMPTS) {
      const mismatchSummary = validation.mismatches.map((m) => `${m.kind} ja=${m.source} en=${m.target}`).join(', ');
      console.warn(
        `[auto-translate] structure mismatch (attempt ${attempt}/${TOTAL_ATTEMPTS}) for ${slug}: ${mismatchSummary} — retrying`,
      );
      feedback = buildFeedback(validation);
    }
    // 最終試行失敗時は呼び出し元（main.ts）で error ログを出すため、ここでは出力しない（重複防止）
  }
  return { ok: false, attempts: TOTAL_ATTEMPTS };
}

export async function translateOne(args: TranslateOneArgs): Promise<TranslateResult> {
  const { jaContent, enContent, geminiClient, model, jaPath } = args;
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
    try {
      const en = splitFrontmatter(enContent);
      if (isAutoTranslated(en.frontmatter)) {
        existingEnHash = getAutoTranslatedFrom(en.frontmatter);
        const titleRaw = en.frontmatter.title;
        cachedTranslatedTitle = typeof titleRaw === 'string' ? titleRaw : '';
        cachedEnBody = en.body;
      }
    } catch {
      // 既存 en がパースできない場合は新規翻訳扱い
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
    outcome = await callWithRetries(geminiClient, model, { title: jaTitle, body: ja.body }, slug);
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
    return {
      kind: 'failed',
      reason: `structure mismatch persisted after ${outcome.attempts} attempts, keeping existing .en.md`,
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

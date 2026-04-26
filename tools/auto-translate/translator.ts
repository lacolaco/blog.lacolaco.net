import { createHash } from 'node:crypto';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { buildEnFrontmatter, isAutoTranslated, type Frontmatter } from './frontmatter.ts';
import { validateStructure } from './structure-validator.ts';

export const PROMPT_VERSION = 1;
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

function buildFeedback(source: string, target: string): string {
  const result = validateStructure(source, target);
  const lines = ['The translation has structural mismatches with the source:'];
  for (const m of result.mismatches) {
    lines.push(`- ${m.kind}: source has ${m.source}, translation has ${m.target}`);
  }
  lines.push('');
  lines.push(
    'Please retranslate ensuring all code blocks, links, images, and bare URL paragraphs from the source are preserved exactly. Do not omit, merge, or wrap any URL into prose.',
  );
  return lines.join('\n');
}

async function callWithRetries(
  client: GeminiClient,
  model: string,
  input: { title: string; body: string },
): Promise<{ ok: true; output: GeminiOutput; attempts: number } | { ok: false; attempts: number }> {
  let feedback: string | undefined;
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const output = await client({ title: input.title, body: input.body, feedback }, model);
    const validation = validateStructure(input.body, output.body_en);
    if (validation.ok) {
      return { ok: true, output, attempts: attempt };
    }
    if (attempt > MAX_RETRIES) {
      return { ok: false, attempts: attempt };
    }
    feedback = buildFeedback(input.body, output.body_en);
  }
  // unreachable
  return { ok: false, attempts: MAX_RETRIES + 1 };
}

export async function translateOne(args: TranslateOneArgs): Promise<TranslateResult> {
  const { jaContent, enContent, geminiClient, model } = args;

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
        const hashRaw = en.frontmatter.auto_translated_from;
        const titleRaw = en.frontmatter.title;
        existingEnHash = typeof hashRaw === 'string' ? hashRaw : '';
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

  // API 呼ぶ（リトライ込み）
  let outcome: Awaited<ReturnType<typeof callWithRetries>>;
  try {
    outcome = await callWithRetries(geminiClient, model, { title: jaTitle, body: ja.body });
  } catch (e) {
    return { kind: 'failed', reason: `Gemini API error: ${(e as Error).message}` };
  }

  if (!outcome.ok) {
    return { kind: 'failed', reason: `structure validation failed after ${outcome.attempts} attempts` };
  }

  const enFrontmatter = buildEnFrontmatter({
    jaFrontmatter: ja.frontmatter,
    translatedTitle: outcome.output.title_en,
    bodyHash: newHash,
  });
  const enFullContent = joinFrontmatter(enFrontmatter, outcome.output.body_en);
  return { kind: 'translated', enContent: enFullContent };
}

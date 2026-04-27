import { GoogleGenAI, Type } from '@google/genai';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { classifyFile, jaToEnPath } from './discover.ts';
import type { CodeTranslatorClient } from './code-translator.ts';
import type { ProofreaderClient } from './proofreader.ts';
import { splitFrontmatter, translateOne, DEFAULT_MODEL, type GeminiClient } from './translator.ts';
import type { Frontmatter } from './frontmatter.ts';

const SYSTEM_INSTRUCTION = `You are a professional technical translator specializing in Japanese-to-English translation of personal technology blog articles.

Translate the given Japanese article into natural, fluent English in the style of an individual engineer's personal blog. Preserve the author's voice and the original register.

Voice and register preservation (CRITICAL):
- The author often uses tentative, reflective, or interrogative phrasing such as 「〜のように思う」「〜ではなかろうか」「〜かもしれない」「〜という気がする」. These convey the author's hedged opinion or invite reflection. Translate them with English hedging such as "I think", "perhaps", "it seems to me", "I wonder if", "may be", "might be" — NOT as flat assertions.
- Do NOT add intensifiers ("true", "real", "essential") that are not in the source.
- Do NOT add imperatives ("you must", "you should") when the source is descriptive or proposal-like ("〜として見る", "〜することが大切ではないか").
- Rhetorical questions ("〜ではなかろうか", "〜ではないか") should be translated as questions or with "perhaps" / "I wonder if" hedging, not as assertions.
- Match the source's level of formality. Casual Japanese ("〜だ", "〜と思う") maps to a personal blog tone, not a corporate whitepaper tone.

Title rules:
- Translate the title with the same level of brevity and directness as the source.
- Do NOT expand short Japanese titles into long descriptive English titles. If the source is "Xを対象として見る", prefer "Viewing X as an Object" over "Viewing X as the Object of Your Work".
- Avoid adding clarifying phrases that are not in the source.

Code placeholders (CRITICAL — read carefully):
The body you receive has had its code blocks and inline code replaced with opaque placeholders:
- ⟨⟨BLOCK_0⟩⟩, ⟨⟨BLOCK_1⟩⟩, ... — represent fenced code blocks
- ⟨⟨INLINE_0⟩⟩, ⟨⟨INLINE_1⟩⟩, ... — represent inline code (was wrapped in backticks in the source)

Rules for placeholders:
- Each placeholder MUST appear exactly once in your output, in a position that corresponds to where the original code appeared in the source.
- Do NOT translate, modify, or remove placeholders. Copy them verbatim.
- Do NOT invent new placeholders.
- Do NOT wrap placeholders in additional backticks, brackets, or formatting.
- When you reference a placeholder in prose (e.g., describing what the code does), refer to it by its placeholder token directly.

Escape markers (⟪⟪ and ⟫⟫):
- The source you receive may contain the literal sequences ⟪⟪ and ⟫⟫ (mathematical double angle brackets, U+27EA / U+27EB).
- These are escape markers used internally to avoid conflicts when the source prose itself mentions ⟨⟨ / ⟩⟩.
- Treat ⟪⟪ and ⟫⟫ as opaque verbatim text: keep them exactly as they appear, in the same positions. Do NOT translate, modify, normalize, or remove them.

Other structural rules:
- URLs and image paths: leave unchanged.
- Bare URL paragraphs (a paragraph consisting only of a single URL) MUST remain as standalone paragraphs containing only that URL. Do NOT wrap them in prose, do NOT add surrounding sentences.
- Markdown structure (heading levels, lists, blockquotes, tables) must be preserved.
- Code blocks AND inline code INSIDE blockquotes (lines starting with "> ") are NOT replaced by placeholders and appear in the source you receive. Keep these blockquote-nested code blocks AND inline code (text wrapped in backticks within blockquotes) BYTE-FOR-BYTE identical to the source. Do NOT translate their comments. Do NOT change any character including quotation marks, dashes, or whitespace.
- LaTeX math ($...$ and $$...$$) and Mermaid: keep as-is.

Output only the translated title and body (with placeholders preserved) in the requested JSON schema. Do not include the YAML frontmatter.`;

const PROOFREADER_INSTRUCTION = `You are a meticulous bilingual (Japanese-English) technical proofreader for software engineering blog articles. You receive a Japanese source and its English translation. Your role is to detect TRANSLATION-INDUCED defects that mislead the reader.

CRITICAL: only flag issues that were introduced by the translation. If the same issue exists in the Japanese source, it is the author's editorial choice and you MUST NOT flag it. Always cross-check the source before flagging.

Detect:
1. Translation-induced identifier mismatches: prose in the English translation references a name (in backticks) that does not appear in surrounding code blocks, AND the Japanese source did not have that same mismatch. Example: source uses \`waiting\` but translation says \`active\`.
2. Inverted meaning: negation flipped, comparison reversed, "before" vs "after" swapped between source and translation.
3. Translation-induced hallucinations: facts/terms/claims in the translation that are not in the source.
4. Translation-induced omissions: significant content from the source missing in the translation.
5. Wrong technical terminology drift: e.g., source uses "debounce" but translation says "throttle"; source uses "object" but translation says "instance".

Do NOT flag:
- Style or tone preferences (the translator handles voice).
- Hedging differences ("I think" vs "perhaps") — both are acceptable.
- Minor word choices that preserve meaning.
- Code blocks themselves (validated separately).
- Differences in code-block COMMENTS between the source and translation. Comments inside fenced code blocks are translated by a separate pipeline stage; the translation intentionally renders Japanese comments in English (or leaves English-only comments unchanged). Do NOT flag comment-level differences inside fenced code blocks.
- Note that this comment-translation only applies to top-level fenced code blocks. Code blocks INSIDE blockquotes (lines starting with "> ") are NOT translated by the comment-translation stage and are kept byte-for-byte identical to the source. Do NOT flag a blockquote-nested code block as a defect just because its comments remain in Japanese.
- ANY inconsistency that exists identically in the Japanese source. If the source uses an identifier informally (e.g., source prose says \`active\` referring to a variable named \`activePromise\` in code), the translation may faithfully preserve this. This is the author's choice, not a defect.

If the translation has no translation-induced defects, return ok=true and empty issues. Otherwise return ok=false with a precise list of issues.

For each issue, "location" must be a concrete reference (e.g., "paragraph 3", "the sentence containing 'setTimeout'"), "problem" describes what is wrong AND confirms the source does NOT have this issue, "suggestion" gives the correct phrasing.`;

const CODE_TRANSLATOR_INSTRUCTION = `You translate ONLY the natural-language comments inside a code block. Everything else (code identifiers, strings, syntax, indentation, fence markers, blank lines) must remain BYTE-FOR-BYTE identical to the input.

Rules:
- Translate Japanese (or non-English) comments to natural English. Do not translate code-only comments like "TODO" or single-word tags.
- Preserve the comment delimiter exactly (// , #, /* */, <!-- -->, etc.) and the position of each comment line.
- Do NOT change identifiers, string literals, numeric literals, operators, or any non-comment content.
- Do NOT add or remove lines. The line count of input and output MUST match exactly.
- Do NOT change the language tag of the fence (\`\`\`ts must stay \`\`\`ts, etc.).
- The code may contain the literal sequences ⟪⟪ or ⟫⟫ (escape markers used by the upstream pipeline). They can appear ANYWHERE inside the code block, INCLUDING inside comments. Keep them BYTE-FOR-BYTE in their original positions. Do NOT translate, modify, normalize, or remove them, even if they appear inside a natural-language comment you are translating.
- Place the translated code block (including the surrounding triple-backtick fences) into the \`translated_code\` JSON field as required by the response schema.`;

function createCodeTranslatorClient(ai: GoogleGenAI): CodeTranslatorClient {
  return async (code, model) => {
    const response = await ai.models.generateContent({
      model,
      contents: code,
      config: {
        systemInstruction: CODE_TRANSLATOR_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            translated_code: { type: Type.STRING },
          },
          required: ['translated_code'],
        },
      },
    });
    const text = response.text;
    if (!text) throw new Error('Empty response from code translator');
    const parsed = JSON.parse(text) as { translated_code: string };
    if (typeof parsed.translated_code !== 'string') {
      throw new Error('Code translator response did not match schema');
    }
    return parsed.translated_code;
  };
}

function createProofreaderClient(ai: GoogleGenAI): ProofreaderClient {
  return async (input, model) => {
    // ソースと訳文はマークダウン（コードブロック含む）が含まれるので、フェンスで囲むと
    // 内部の ```ts 等がアウターフェンスを誤閉じして LLM が構造を見失う。XML 風タグで囲って区切る
    const userMessage = [
      '<japanese-source>',
      input.jaSource,
      '</japanese-source>',
      '',
      '<english-translation>',
      input.enTranslation,
      '</english-translation>',
    ].join('\n');

    const response = await ai.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: PROOFREADER_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            ok: { type: Type.BOOLEAN },
            issues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  location: { type: Type.STRING },
                  problem: { type: Type.STRING },
                  suggestion: { type: Type.STRING },
                },
                required: ['location', 'problem', 'suggestion'],
                propertyOrdering: ['location', 'problem', 'suggestion'],
              },
            },
          },
          required: ['ok', 'issues'],
          propertyOrdering: ['ok', 'issues'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from proofreader');
    const parsed = JSON.parse(text) as {
      ok: boolean;
      issues: { location: string; problem: string; suggestion: string }[];
    };
    if (typeof parsed.ok !== 'boolean' || !Array.isArray(parsed.issues)) {
      throw new Error('Proofreader response did not match schema');
    }
    // 各 issue の必須フィールドが string であることを検証（responseSchema が強制するが、
    // SDK 側のバグや malformed JSON を想定して防御的に確認）
    const issuesValid = parsed.issues.every(
      (i) => typeof i.location === 'string' && typeof i.problem === 'string' && typeof i.suggestion === 'string',
    );
    if (!issuesValid) {
      throw new Error('Proofreader issue items did not match schema');
    }
    return { ok: parsed.ok, issues: parsed.issues };
  };
}

function createGeminiClient(ai: GoogleGenAI): GeminiClient {
  return async (input, model) => {
    const userMessageParts = [`Title: ${input.title}`, '', 'Body:', input.body];
    if (input.feedback) {
      userMessageParts.push('', '---', '', 'Feedback from previous attempt:', input.feedback);
    }
    const userMessage = userMessageParts.join('\n');

    const response = await ai.models.generateContent({
      model,
      contents: userMessage,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title_en: { type: Type.STRING },
            body_en: { type: Type.STRING },
          },
          required: ['title_en', 'body_en'],
          propertyOrdering: ['title_en', 'body_en'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from Gemini');
    const parsed = JSON.parse(text) as { title_en: string; body_en: string };
    if (typeof parsed.title_en !== 'string' || typeof parsed.body_en !== 'string') {
      throw new Error('Gemini response did not match schema');
    }
    // 空文字列はスキーマ的には valid だが、構造検証に偶然パスして空ファイルが生成されるリスクがある
    if (parsed.title_en.length === 0 || parsed.body_en.length === 0) {
      throw new Error('Gemini response contains empty title_en or body_en');
    }
    return { title_en: parsed.title_en, body_en: parsed.body_en };
  };
}

interface Stats {
  translated: number;
  frontmatterOnly: number;
  skipped: number;
  deleted: number;
  failed: number;
  protectedManual: number;
}

async function listJaFiles(contentDir: string): Promise<string[]> {
  const entries = await readdir(contentDir, { withFileTypes: true });
  const jaFiles: string[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith('.md')) continue;
    if (entry.name.endsWith('.en.md')) continue;
    jaFiles.push(path.join(contentDir, entry.name));
  }
  return jaFiles;
}

type ReadEnResult =
  | { kind: 'present'; content: string; frontmatter: Frontmatter }
  | { kind: 'absent' }
  | { kind: 'parse-error'; error: Error };

async function readEn(enPath: string): Promise<ReadEnResult> {
  let content: string;
  try {
    content = await readFile(enPath, 'utf8');
  } catch (e) {
    // ファイル不在は absent。それ以外（権限・I/O）は伝播
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { kind: 'absent' };
    throw e;
  }
  try {
    const { frontmatter } = splitFrontmatter(content);
    return { kind: 'present', content, frontmatter };
  } catch (e) {
    // パース不能な en は手動翻訳の破損か自動翻訳の破損か区別できない。
    // 手動 en を上書きするリスクを避けるため、当該記事は failed として skip する
    return { kind: 'parse-error', error: e as Error };
  }
}

async function main(): Promise<void> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  if (!apiKey) {
    console.log('[auto-translate] GEMINI_API_KEY 未設定により skip');
    return;
  }

  const rootDir = new URL('../..', import.meta.url).pathname;
  const contentDir = path.join(rootDir, 'src/content/post/notion');
  const jaFiles = await listJaFiles(contentDir);

  console.log(`[auto-translate] scanning ${jaFiles.length} ja files in ${contentDir}`);
  console.log(`[auto-translate] model: ${model}`);

  // GoogleGenAI は内部で HTTP クライアントを保持するため、3 用途で 1 インスタンスを共有する
  const ai = new GoogleGenAI({ apiKey });
  const client = createGeminiClient(ai);
  const proofreader = createProofreaderClient(ai);
  const codeTranslator = createCodeTranslatorClient(ai);
  const stats: Stats = {
    translated: 0,
    frontmatterOnly: 0,
    skipped: 0,
    deleted: 0,
    failed: 0,
    protectedManual: 0,
  };

  for (const jaPath of jaFiles) {
    const enPath = jaToEnPath(jaPath);
    const baseName = path.basename(jaPath);

    let jaContent: string;
    let ja: Frontmatter;
    try {
      jaContent = await readFile(jaPath, 'utf8');
      ja = splitFrontmatter(jaContent).frontmatter;
    } catch (e) {
      console.error(`[auto-translate] ja parse error for ${baseName}: ${(e as Error).message}`);
      stats.failed++;
      continue;
    }

    let enFile: ReadEnResult;
    try {
      enFile = await readEn(enPath);
    } catch (e) {
      // 権限エラー等の I/O 異常は当該記事を失敗扱いにして継続
      console.error(`[auto-translate] failed to read en for ${baseName}: ${(e as Error).message}`);
      stats.failed++;
      continue;
    }
    if (enFile.kind === 'parse-error') {
      // YAML 破損した en が手動 en か自動 en か区別できない。手動 en の保護を優先して skip
      console.error(
        `[auto-translate] en frontmatter parse error for ${path.basename(enPath)}: ${enFile.error.message} — skipping to protect potentially manual en`,
      );
      stats.failed++;
      continue;
    }
    const enFrontmatter = enFile.kind === 'present' ? enFile.frontmatter : null;
    const enContent = enFile.kind === 'present' ? enFile.content : null;

    const action = classifyFile({ jaPath, enPath, ja, en: enFrontmatter });

    switch (action.kind) {
      case 'skip':
        stats.skipped++;
        break;
      case 'protect-manual':
        console.warn(
          `[auto-translate] protect-manual (manual en exists): ${baseName} -> ${path.basename(action.enPath)}`,
        );
        stats.protectedManual++;
        break;
      case 'delete-orphan':
        try {
          await unlink(enPath);
          console.log(`[auto-translate] removed orphaned auto-translation: ${path.basename(enPath)}`);
          stats.deleted++;
        } catch (e) {
          console.error(`[auto-translate] failed to delete ${path.basename(enPath)}: ${(e as Error).message}`);
          stats.failed++;
        }
        break;
      case 'translate':
      case 'evaluate-cache': {
        const result = await translateOne({
          jaPath,
          enPath,
          jaContent,
          enContent,
          geminiClient: client,
          proofreaderClient: proofreader,
          codeTranslatorClient: codeTranslator,
          model,
        });
        switch (result.kind) {
          case 'translated':
            try {
              await writeFile(enPath, result.enContent, 'utf8');
              console.log(`[auto-translate] translated: ${path.basename(enPath)}`);
              stats.translated++;
            } catch (e) {
              console.error(`[auto-translate] failed to write ${path.basename(enPath)}: ${(e as Error).message}`);
              stats.failed++;
            }
            break;
          case 'frontmatter-only':
            try {
              await writeFile(enPath, result.enContent, 'utf8');
              console.log(`[auto-translate] frontmatter-only: ${path.basename(enPath)}`);
              stats.frontmatterOnly++;
            } catch (e) {
              console.error(`[auto-translate] failed to write ${path.basename(enPath)}: ${(e as Error).message}`);
              stats.failed++;
            }
            break;
          case 'skipped':
            stats.skipped++;
            break;
          case 'failed':
            console.error(`[auto-translate] failed: ${baseName}: ${result.reason}`);
            stats.failed++;
            break;
        }
        break;
      }
    }
  }

  console.log('[auto-translate] summary:', stats);
}

main().catch((e) => {
  // ループ内の per-article エラー（API 失敗等）は main 内で既に catch して stats.failed に集計している。
  // ここに到達するのはインフラ障害（readdir ENOENT・モジュール初期化失敗等）のみ。
  // 設定ミスをサイレントに見逃さないため exit 1 で失敗を明示する
  console.error('[auto-translate] fatal infrastructure error:', e);
  process.exit(1);
});

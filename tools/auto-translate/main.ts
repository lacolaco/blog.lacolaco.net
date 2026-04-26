import { GoogleGenAI, Type } from '@google/genai';
import { readFile, writeFile, unlink, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { classifyFile, jaToEnPath } from './discover.ts';
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

Strict structural preservation rules:
- Code blocks: keep the entire code block content BYTE-FOR-BYTE identical to the source. Do NOT translate comments. Do NOT change any character including straight/curly quotation marks, dashes, whitespace, or backticks. The validator compares bytes exactly.
- Inline code (text wrapped in backticks): keep BYTE-FOR-BYTE identical to the source. Do NOT change quotation marks or any character inside backticks.
- URLs and image paths: leave unchanged.
- Bare URL paragraphs (a paragraph consisting only of a single URL) MUST remain as standalone paragraphs containing only that URL. Do NOT wrap them in prose, do NOT add surrounding sentences.
- Markdown structure (heading levels, lists, blockquotes, tables) must be preserved exactly.
- LaTeX math ($...$ and $$...$$) and Mermaid blocks: keep as-is.

Output only the translated title and body in the requested JSON schema. Do not include the YAML frontmatter.`;

function createGeminiClient(apiKey: string): GeminiClient {
  const ai = new GoogleGenAI({ apiKey });
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

  const client = createGeminiClient(apiKey);
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

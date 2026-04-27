// コードブロック内のコメントだけを翻訳するモジュール。
// 実装方針:
// - LLM に「コメントのみ翻訳、syntax は byte 同一に保て」と指示
// - 行数一致と fence 保持を最低限のサニティチェック（厳密な構文検証は LLM では困難）
// - 検証失敗・API 失敗 → 原文を返す（fail-safe）。「翻訳されない」より「壊れる」方が悪い

export type CodeTranslatorClient = (code: string, model: string) => Promise<string>;

export interface TranslateCodeBlockArgs {
  code: string;
  client: CodeTranslatorClient;
  model: string;
}

// 翻訳対象になりうるコメントを含むかの簡易ヒューリスティック。
// 言語非依存に「//」「#」「/* */」「<!-- -->」を検出。
// 改行を跨いで誤検出しないよう、行コメントは [^\n]* で同一行内に限定する
const COMMENT_PATTERNS: RegExp[] = [
  /\/\/[ \t]*([^\n]*)/g, // C/JS/TS line comment
  /\/\*([\s\S]*?)\*\//g, // C/JS block comment
  /<!--([\s\S]*?)-->/g, // HTML comment
  // # コメントは shell/python 等で頻出。`#include` 等の preprocessor を避けるため行頭近接のみ
  /(?:^|\n)[ \t]*#[ \t]+([^\n]*)/g,
];

export function hasTranslatableComment(code: string): boolean {
  // 翻訳ターゲットは英語なので、既に英語のコメントは API を呼ばない（ノイズ・コスト削減）。
  // 非 ASCII 文字（日本語等）を含むコメントだけを翻訳対象とする
  for (const re of COMMENT_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const content = m[1].trim();
      if (content.length === 0) continue;
      if (/[^\x20-\x7e]/.test(content)) return true;
    }
  }
  return false;
}

function lineCount(s: string): number {
  return s.split('\n').length;
}

function isCodeFenceIntact(code: string): boolean {
  // コードフェンスは ``` で開始・終了する想定。fence 行の数が偶数（>=2）であること
  const fenceLines = code.split('\n').filter((l) => /^```/.test(l.trim()));
  return fenceLines.length >= 2 && fenceLines.length % 2 === 0;
}

export async function translateCodeBlock(args: TranslateCodeBlockArgs): Promise<string> {
  const { code, client, model } = args;

  // 翻訳対象がないなら API を呼ばずそのまま返す（コスト削減）
  if (!hasTranslatableComment(code)) return code;

  let translated: string;
  try {
    translated = await client(code, model);
  } catch (e) {
    console.warn(`[auto-translate] code block comment translation failed: ${(e as Error).message} — keeping original`);
    return code;
  }

  // サニティチェック: 行数一致 & fence 健全
  if (lineCount(translated) !== lineCount(code) || !isCodeFenceIntact(translated)) {
    console.warn(
      `[auto-translate] code block comment translation produced malformed output (lines ${lineCount(code)}→${lineCount(translated)}, fence intact=${isCodeFenceIntact(translated)}) — keeping original`,
    );
    return code;
  }

  return translated;
}

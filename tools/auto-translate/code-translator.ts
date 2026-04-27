// コードブロック内のコメントだけを翻訳するモジュール。
// 実装方針:
// - LLM に「コメントのみ翻訳、syntax は byte 同一に保て」と指示
// - 行数一致と fence 保持を最低限のサニティチェック（厳密な構文検証は LLM では困難）
// - 検証失敗・API 失敗 → 原文を返す（fail-safe）。「翻訳されない」より「壊れる」方が悪い

import { errorMessage } from './ast-utils.ts';

export type CodeTranslatorClient = (code: string, model: string) => Promise<string>;

export interface TranslateCodeBlockArgs {
  code: string;
  client: CodeTranslatorClient;
  model: string;
}

// 翻訳対象になりうるコメントを含むかの簡易ヒューリスティック。
// 言語非依存に「//」「#」「/* */」「<!-- -->」を検出。
// 改行を跨いで誤検出しないよう、行コメントは [^\n]* で同一行内に限定する。
// パターンは関数内で都度 new RegExp で生成する（モジュールスコープの g フラグ付き定数は
// lastIndex がイテレーション間で残るため、ステートを持たせないことで堅牢にする）
//
// 既知の限界: 文字列リテラル内のコメントマーカーを誤検出する可能性がある。完全な解析には
// 言語別 lexer が必要なため、よくある偽陽性のみ heuristic で除外する:
// - `://` URL: `(?<!:)\/\/` で URL 内の // を除外
const COMMENT_PATTERN_SOURCES: string[] = [
  '(?<!:)\\/\\/[ \\t]*([^\\n]*)', // C/JS/TS line comment（URL の :// を除外）
  '\\/\\*([\\s\\S]*?)\\*\\/', // C/JS block comment
  '<!--([\\s\\S]*?)-->', // HTML comment
  // # コメントは shell/python 等で頻出。
  // 行頭近接のみ判定（`#include` のような preprocessor 行は内容に来るが、ここでは shebang `#!` を除外）。
  // `#コメント` のようにスペースなしで書かれるスタイルも捉えるため、# 直後のスペースは [ \t]* にする
  '(?:^|\\n)[ \\t]*#(?!!)[ \\t]*([^\\n]*)',
];

// extractCode が prose の ⟨⟨/⟩⟩ を ⟪⟪/⟫⟫ に escape した状態で codeBlocks に格納するため、
// コードブロック内コメントに ⟨⟨...⟩⟩ が含まれる場合（このシステムを解説する記事等）に
// hasTranslatableComment が ⟪ を非 ASCII と誤検出しないよう、判定前に escape マーカーを除去する。
// COMMENT_PATTERN_SOURCES と同じく source 文字列で保持し、使用箇所で new RegExp する
// （g フラグ付きモジュール定数の lastIndex 残留問題を避けるため）
const ESCAPE_MARKER_RE_SOURCE = '⟪⟪|⟫⟫';

export function hasTranslatableComment(code: string): boolean {
  // 翻訳ターゲットは英語なので、既に英語のコメントは API を呼ばない（ノイズ・コスト削減）。
  // 非 ASCII 文字（日本語等）を含むコメントだけを翻訳対象とする。
  // \s（\n, \r, \t 等）はホワイトスペースなので除外する: /* */ や <!-- --> の複数行コメントで
  // m[1] に \n が混じるため、これを非 ASCII 扱いすると英語のみの複数行コメントを誤って翻訳対象にしてしまう
  for (const source of COMMENT_PATTERN_SOURCES) {
    const re = new RegExp(source, 'g');
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      // escape マーカーは upstream のパイプライン都合で挿入された人工的な文字なので、
      // コメント実体の判定からは取り除いて評価する
      const content = m[1].replace(new RegExp(ESCAPE_MARKER_RE_SOURCE, 'g'), '').trim();
      if (content.length === 0) continue;
      if (/[^\x20-\x7e\s]/.test(content)) return true;
    }
  }
  return false;
}

function lineCount(s: string): number {
  return s.split('\n').length;
}

function fenceLines(code: string): string[] {
  // バッククォート（```）とチルダ（~~~）の両形式を扱う。remark もどちらも code ノードとしてパースする。
  // リスト項目内のコードブロックは markdown.slice() がインデント付きの fence 行を含むため、
  // 先頭空白を許容する（"  ```ts" のような行も fence として認識）。
  //
  // 既知の制約: 4-backtick フェンス（meta-documentation で「コードブロックの書き方を解説する
  // コードブロック」として使われる）の内側に含まれる 3-backtick 行も fence 行としてカウントされ、
  // isCodeFenceIntact が false → translateCodeBlock が原文 fallback する。壊れない（機能的欠落のみ）、
  // 個人ブログでの実用頻度が低いため対応保留
  return code.split('\n').filter((l) => /^\s*(?:`{3,}|~{3,})/.test(l));
}

function isCodeFenceIntact(code: string): boolean {
  // コードフェンス行の数が偶数（>=2）であること
  const lines = fenceLines(code);
  return lines.length >= 2 && lines.length % 2 === 0;
}

function fenceLanguageTagsMatch(original: string, translated: string): boolean {
  // 各 fence 行を順に比較し、すべて文字列一致であること（言語タグ・属性も含む）
  const a = fenceLines(original);
  const b = fenceLines(translated);
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// 行コメントとブロックコメントを除去した「非コメント部分」を返す。
// コメント以外（識別子・文字列リテラル等）の改変を検出するために使う。
// 簡易ヒューリスティックなので完全な lexer ではないが、既知の主要コメント形式をカバーする
function stripComments(code: string): string {
  let result = code;
  result = result.replace(/\/\*[\s\S]*?\*\//g, ''); // /* ... */
  result = result.replace(/<!--[\s\S]*?-->/g, ''); // <!-- ... -->
  // (?<!:) 負先読みで URL の :// は除外（hasTranslatableComment と同じヒューリスティック）
  result = result.replace(/(?<!:)\/\/[^\n]*/g, ''); // // line comment
  // # コメント（shebang は除外）。hasTranslatableComment と同じく行頭・行中の両方をカバー。
  // 行頭 #: (^|\n)[ \t]*#(?!!) のあとの行内容を除去（インデント保持）
  result = result.replace(/(^|\n)([ \t]*)#(?!!)[^\n]*/g, '$1$2');
  // 行中 #: 文字列リテラル考慮なしの簡易ヒューリスティック。code 内の前後に空白がある # の後を除去。
  // 偽陽性（"a#b" のような hash 文字使用）は稀であり、stripComments は片方向比較に使うため
  // ja/en で同じ偽陽性除去が起きれば問題にならない
  result = result.replace(/[ \t]+#(?!!)[^\n]*/g, '');
  return result;
}

export async function translateCodeBlock(args: TranslateCodeBlockArgs): Promise<string> {
  const { code, client, model } = args;

  // 翻訳対象がないなら API を呼ばずそのまま返す（コスト削減）
  if (!hasTranslatableComment(code)) return code;

  let translated: string;
  try {
    translated = await client(code, model);
  } catch (e) {
    console.warn(`[auto-translate] code block comment translation failed: ${errorMessage(e)} — keeping original`);
    return code;
  }

  // サニティチェック: 行数一致 & fence 健全 & 言語タグ保全
  if (lineCount(translated) !== lineCount(code)) {
    console.warn(
      `[auto-translate] code block comment translation produced malformed output (lines ${lineCount(code)}→${lineCount(translated)}) — keeping original`,
    );
    return code;
  }
  if (!isCodeFenceIntact(translated)) {
    console.warn(`[auto-translate] code block comment translation broke fence structure — keeping original`);
    return code;
  }
  if (!fenceLanguageTagsMatch(code, translated)) {
    console.warn(
      `[auto-translate] code block comment translation modified fence (language tag changed?) — keeping original`,
    );
    return code;
  }
  // 非コメント部分（識別子・文字列リテラル等）が改変されていないか確認。
  // LLM が「コメント翻訳のついでに」識別子や文字列を変更するケースを検出する
  if (stripComments(code) !== stripComments(translated)) {
    console.warn(
      `[auto-translate] code block comment translation modified non-comment content (identifiers / string literals?) — keeping original`,
    );
    return code;
  }

  return translated;
}

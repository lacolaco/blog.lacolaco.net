/** 全記事の作り直しを明示するフラグ */
export const ALL_FLAG = '--all';

export interface ParsedArgs {
  /** 全記事を対象にするか */
  renderAll: boolean;
  /** 対象として渡された記事のパス */
  requested: string[];
}

/**
 * コマンドライン引数を解釈する。
 *
 * 引数なしは「描くものがない」として扱う。記事の削除だけ、tags.json の更新だけ、
 * という sync は正常にありうる。全記事と解釈すると、そのたびに全件再生成が走る。
 *
 * 併用を黙って無視すると、渡したのに描かれなかったことに気付けない。
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const renderAll = argv.includes(ALL_FLAG);
  const requested = argv.filter((arg) => arg !== ALL_FLAG);

  if (renderAll && requested.length > 0) {
    throw new Error(`${ALL_FLAG} と記事のパスは同時に指定できない: ${requested.join(' ')}`);
  }
  return { renderAll, requested };
}

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
 * 引数なしを全記事と解釈すると、呼び出し側が空の差分をそのまま渡したときに
 * 気付かないまま全件再生成が走る。それはこの設計が避けようとしている無駄そのものなので、
 * 全記事は明示させる。
 *
 * 併用を黙って無視すると、渡したのに描かれなかったことに気付けない。
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const renderAll = argv.includes(ALL_FLAG);
  const requested = argv.filter((arg) => arg !== ALL_FLAG);

  if (renderAll && requested.length > 0) {
    throw new Error(`${ALL_FLAG} と記事のパスは同時に指定できない: ${requested.join(' ')}`);
  }
  if (!renderAll && requested.length === 0) {
    throw new Error(`生成対象が指定されていない。記事のパスを渡すか、全記事を作り直すなら ${ALL_FLAG} を付ける`);
  }

  return { renderAll, requested };
}

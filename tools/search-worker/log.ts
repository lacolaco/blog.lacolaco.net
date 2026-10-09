// 検索イベントの構造化ログ。Cloudflare に依存しない関数にして、Node のテストで検証する。
// ログの利用側 (BigQuery の search_events ビュー) との取り決めは infra/README.md を参照。

export interface SearchLogFields {
  q: string;
  locale: string;
  hits: number;
  ms: number;
}

/**
 * 検索イベントの 1 行 JSON を作る。
 * id は 1 回の検索を見分ける識別子で、検索語や読者から導かない乱数 (UUID v4) にする。
 * Logpush が同じ行を重ねて送っても、ビューが同じ id の行を 1 行にする。
 */
export function searchLogLine(fields: SearchLogFields, newId: () => string = () => crypto.randomUUID()): string {
  return JSON.stringify({ event: 'search', id: newId(), ...fields });
}

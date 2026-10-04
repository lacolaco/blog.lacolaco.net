// 検索 Worker の管理用エンドポイントへ、ビルドが出力した記事データを送って索引を全件入れ替える CI 用スクリプト。
//   SEARCH_ADMIN_TOKEN=... tsx tools/search-worker/push-index.ts <Worker の URL>
// 管理用トークンは環境変数から読む (引数やログに出さない)。
import { readFile } from 'node:fs/promises';
import pRetry, { AbortError } from 'p-retry';

const DOCS_PATH = 'dist/client/search-docs.json';
const ADMIN_PATH = '/api/search/admin/index';

const [, , baseUrl] = process.argv;
const token = process.env.SEARCH_ADMIN_TOKEN;
if (!baseUrl || !token) {
  console.error('usage: SEARCH_ADMIN_TOKEN=... push-index.ts <worker-url>');
  process.exit(2);
}

const body = await readFile(DOCS_PATH, 'utf-8');
const count = (JSON.parse(body) as unknown[]).length;
if (count === 0) throw new Error(`${DOCS_PATH} が空。ビルドの出力を確認すること`);
console.log(`${count} 件の記事を送る`);

await pRetry(
  async () => {
    const res = await fetch(new URL(ADMIN_PATH, baseUrl), {
      method: 'PUT',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body,
    });
    const text = await res.text();
    // 再試行で直らないもの (トークンの誤り、本文の誤り) だけすぐ止める。
    // 404 は本番のルートが反映される前に Cloud Run へ届いた場合や、作ったばかりの Worker の workers.dev が反映される前 (数分かかることがある)、5xx は作りたての Preview の
    // Durable Object が使えるようになる前 (数秒から十数秒続く) に起こるので、待って再試行する
    if (res.status === 400 || res.status === 401 || res.status === 405) throw new AbortError(`${res.status} ${text}`);
    if (!res.ok) throw new Error(`${res.status} ${text}`);
    console.log(text);
  },
  {
    retries: 8,
    minTimeout: 2000,
    maxTimeout: 15000,
    onFailedAttempt: (e) => console.warn(`再試行: ${e.error.message}`),
  },
);

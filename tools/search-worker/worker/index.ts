// サイト内検索の Worker。HTTP の窓口と Durable Object (SQLite ストレージ) を 1 つの Worker に持つ。
// SQL と順位付けは search.ts にあり、品質テストと同じコードを実行する。
import { DurableObject } from 'cloudflare:workers';
import { corsHeaders, isBearerAuthorized, parseIndexDocs } from '../http.ts';
import { searchLogLine } from '../log.ts';
import {
  ensureSchema,
  replaceAll,
  search,
  type IndexDoc,
  type Locale,
  type SearchHit,
  type SqlExec,
} from '../search.ts';

interface Env {
  SEARCH: DurableObjectNamespace<SearchDO>;
  /** 管理用エンドポイントの Bearer トークン (secret) */
  ADMIN_TOKEN?: string;
  /** CORS で許可するオリジンの正規表現。本番は同一オリジンなので未設定 (プレビューだけ設定する) */
  ALLOWED_ORIGIN_PATTERN?: string;
}

// 全リクエストが同じ 1 つの DO に届く。DO は最初の get() の近くに作られ、以後移動しないので、
// 東京からの検索が多い本番では apac-ne を明示する (ヒントは名前ごとの最初の get() にだけ適用される)。
// Preview はこの Worker の別バージョンではなく別の DO 名前空間を持つので、同じ名前でもデータは混ざらない
const INDEX_NAME = 'index';
const LOCATION_HINT = 'apac-ne';
const MAX_QUERY_LENGTH = 200;

export class SearchDO extends DurableObject<Env> {
  private readonly exec: SqlExec;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.exec = (sql, ...binds) => ctx.storage.sql.exec(sql, ...(binds as SqlStorageValue[])).toArray();
    // 索引が空 (初回) でも検索が空の結果を返せるように表を作っておく
    void ctx.blockConcurrencyWhile(() => {
      ensureSchema(this.exec);
      return Promise.resolve();
    });
  }

  search(q: string, locale: Locale): SearchHit[] {
    return search(this.exec, q, locale);
  }

  /**
   * 索引を全件入れ替える。transactionSync は同期で完結し、DO は 1 つのスレッドで動くので、
   * 入れ替え中の検索は終わるまで待たされ、古い索引か新しい索引のどちらかだけを見る。
   * 途中で失敗したら全体がロールバックされ、古い索引が残る。
   */
  replace(docs: IndexDoc[]): { count: number } {
    this.ctx.storage.transactionSync(() => replaceAll(this.exec, docs));
    return { count: docs.length };
  }
}

const json = (body: unknown, init: ResponseInit & { headers?: Record<string, string> } = {}) =>
  Response.json(body, { ...init, headers: { 'cache-control': 'no-store', ...init.headers } });

async function handle(req: Request, env: Env): Promise<Response> {
  const t0 = Date.now();
  const url = new URL(req.url);
  const stub = env.SEARCH.get(env.SEARCH.idFromName(INDEX_NAME), { locationHint: LOCATION_HINT });

  // 管理用エンドポイント: 索引の入れ替え (PUT)。Bearer トークンで保護する。
  // 本番のルート (blog.lacolaco.net/api/search*) に載るよう、検索と同じ /api/search 配下に置く
  if (url.pathname === '/api/search/admin/index') {
    if (!(await isBearerAuthorized(req.headers.get('authorization'), env.ADMIN_TOKEN)))
      return json({ error: 'unauthorized' }, { status: 401 });
    if (req.method === 'PUT') {
      const docs = await parseIndexDocs(req);
      if (!docs) return json({ error: 'invalid body' }, { status: 400 });
      return json(await stub.replace(docs));
    }
    return json({ error: 'method not allowed' }, { status: 405 });
  }

  if (url.pathname !== '/api/search') return json({ error: 'not found' }, { status: 404 });
  const cors = corsHeaders(req.headers.get('origin'), env.ALLOWED_ORIGIN_PATTERN);
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: { ...cors, 'access-control-allow-methods': 'GET', 'access-control-max-age': '86400' },
    });
  }
  if (req.method !== 'GET') return json({ error: 'method not allowed' }, { status: 405, headers: cors });

  const q = url.searchParams.get('q') ?? '';
  const locale = url.searchParams.get('locale');
  if (locale !== 'ja' && locale !== 'en')
    return json({ error: 'locale must be ja or en' }, { status: 400, headers: cors });
  if (q.length > MAX_QUERY_LENGTH) return json({ error: 'q is too long' }, { status: 400, headers: cors });

  const hits = await stub.search(q, locale);
  // 検索語の収集用の構造化ログ (1 行の JSON)
  console.log(searchLogLine({ q, locale, hits: hits.length, ms: Date.now() - t0 }));
  return json(hits, { headers: cors });
}

export default {
  async fetch(req, env): Promise<Response> {
    try {
      return await handle(req, env);
    } catch (e) {
      // 想定外の例外。原因を構造化ログに残し、利用者には内部の詳細を返さない
      console.error(JSON.stringify({ event: 'error', message: String(e) }));
      return json({ error: 'internal error' }, { status: 500 });
    }
  },
} satisfies ExportedHandler<Env>;

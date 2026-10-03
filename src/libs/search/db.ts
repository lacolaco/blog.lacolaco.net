// SQLite FTS5 (trigram) による検索。SQL と順位付けは評価ハーネスの engines/sqlite-fts5.ts と同一。
// - 3文字以上の語は MATCH のフレーズ (AND)、3文字未満の語は LIKE (trigram は3文字未満に一致しないため)
// - 正規化は JS 側で NFKC + 小文字化してから索引と検索の両方へ入れる
// - 順位は bm25(題名の重み 10, 本文の重み 1)。2文字以下のみのクエリは題名一致 → 出現回数
// - locale は別テーブル (fts_ja / fts_en)
import { DatabaseSync } from 'node:sqlite';

export type Locale = 'ja' | 'en';
export interface SearchDoc {
  slug: string;
  locale: Locale;
  title: string;
  body: string;
}
export interface SearchHit {
  slug: string;
  title: string;
  score: number;
}

const W_TITLE = 10;
const W_BODY = 1;
export const normalize = (s: string): string => s.normalize('NFKC').toLowerCase();
const len = (s: string) => [...s].length;
const lit = (s: string) => `"${s.replaceAll('"', '""')}"`;
const likeEsc = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export function createDb(docs: SearchDoc[], path: string): void {
  const d = new DatabaseSync(path);
  d.exec('PRAGMA journal_mode=OFF; PRAGMA synchronous=OFF;');
  for (const l of ['ja', 'en'])
    d.exec(
      `CREATE VIRTUAL TABLE fts_${l} USING fts5(slug UNINDEXED, raw_title UNINDEXED, title, body, tokenize='trigram');`,
    );
  d.exec('BEGIN');
  const ins = {
    ja: d.prepare('INSERT INTO fts_ja(slug,raw_title,title,body) VALUES (?,?,?,?)'),
    en: d.prepare('INSERT INTO fts_en(slug,raw_title,title,body) VALUES (?,?,?,?)'),
  };
  for (const x of docs) ins[x.locale].run(x.slug, x.title, normalize(x.title), normalize(x.body));
  d.exec('COMMIT');
  d.exec(`INSERT INTO fts_ja(fts_ja) VALUES('optimize'); INSERT INTO fts_en(fts_en) VALUES('optimize');`);
  d.close();
}

export function openReadOnly(path: string): DatabaseSync {
  return new DatabaseSync(path, { readOnly: true });
}

export function search(db: DatabaseSync, q: string, locale: Locale, limit = 20): SearchHit[] {
  const terms = normalize(q).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  const table = `fts_${locale}`;
  const long = terms.filter((t) => len(t) >= 3);
  const short = terms.filter((t) => len(t) < 3);
  const where: string[] = [];
  const params: string[] = [];
  if (long.length) {
    where.push(`${table} MATCH ?`);
    params.push(long.map(lit).join(' AND '));
  }
  for (const t of short) {
    where.push(`(title LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\')`);
    params.push(`%${likeEsc(t)}%`, `%${likeEsc(t)}%`);
  }
  if (long.length) {
    // bm25 は小さい (負に大きい) ほど上位。score は大きいほど上位になるよう符号を反転する
    const w = `0, 0, ${W_TITLE}, ${W_BODY}`;
    const sql = `SELECT slug, raw_title AS title, -bm25(${table}, ${w}) AS score FROM ${table} WHERE ${where.join(' AND ')} ORDER BY bm25(${table}, ${w}), slug LIMIT ${limit}`;
    return db.prepare(sql).all(...params) as unknown as SearchHit[];
  }
  const score = short.map(
    () => `((title LIKE ? ESCAPE '\\')*1000 + (length(body)-length(replace(body, ?, '')))/MAX(length(?),1))`,
  );
  const sp: string[] = [];
  for (const t of short) sp.push(`%${likeEsc(t)}%`, t, t);
  const sql = `SELECT slug, raw_title AS title, (${score.join(' + ')}) AS score FROM ${table} WHERE ${where.join(' AND ')} ORDER BY score DESC, slug LIMIT ${limit}`;
  return db.prepare(sql).all(...sp, ...params) as unknown as SearchHit[];
}

// node:sqlite の DatabaseSync を、Worker と同じ検索コード (search.ts) に渡せる形にする (Node 専用。テスト用)。
import { DatabaseSync } from 'node:sqlite';
import type { SqlExec } from './search.ts';

export function openMemoryDb(): { db: DatabaseSync; exec: SqlExec; inTransaction: (fn: () => void) => void } {
  const db = new DatabaseSync(':memory:');
  const exec: SqlExec = (sql, ...binds) => db.prepare(sql).all(...(binds as never[]));
  // DO の transactionSync に当たる。失敗したらロールバックする
  const inTransaction = (fn: () => void) => {
    db.exec('BEGIN');
    try {
      fn();
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  return { db, exec, inTransaction };
}

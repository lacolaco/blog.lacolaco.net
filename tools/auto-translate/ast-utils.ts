// mdast/unist 共通の ast 判定ユーティリティ + 共通エラー文字列化。
// 複数モジュールで使う AST 判定や定型処理はここに集約する

import type { Parent } from 'unist';

/**
 * ノードが blockquote の子孫かどうか判定する。
 * blockquote 内のコード/インラインコードは特殊扱い（プレースホルダ化対象外、
 * 別経路で byte 一致検証）するため、複数モジュールで使う共通判定。
 */
export function hasBlockquoteAncestor(ancestors: readonly Parent[]): boolean {
  return ancestors.some((a) => a.type === 'blockquote');
}

/**
 * catch (e) で受けた unknown 値から人間可読なメッセージを取り出す。
 * Error インスタンスでない値（throw 'string' / throw {...} 等）にも対応する。
 * (e as Error).message のキャストはランタイム値が Error でないと undefined を返すため使用しない
 */
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

// mdast/unist 共通の ast 判定ユーティリティ。
// 複数モジュールで使う AST 判定はここに集約する

import type { Parent } from 'unist';

/**
 * ノードが blockquote の子孫かどうか判定する。
 * blockquote 内のコード/インラインコードは特殊扱い（プレースホルダ化対象外、
 * 別経路で byte 一致検証）するため、複数モジュールで使う共通判定。
 */
export function hasBlockquoteAncestor(ancestors: readonly Parent[]): boolean {
  return ancestors.some((a) => a.type === 'blockquote');
}

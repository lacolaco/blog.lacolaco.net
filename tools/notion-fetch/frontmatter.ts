import { stringify as yamlStringify, parse as yamlParse } from 'yaml';

/**
 * フロントマターオブジェクトをYAML文字列にフォーマットする純粋関数
 * 任意のオブジェクト型を受け付ける汎用ユーティリティ関数
 */
export function formatFrontmatter(frontmatter: unknown): string {
  const yaml = yamlStringify(frontmatter, {
    defaultStringType: 'QUOTE_SINGLE',
    defaultKeyType: 'PLAIN',
    doubleQuotedAsJSON: true,
  }).trim();

  return yaml;
}

/**
 * Markdownファイルからフロントマターを抽出する純粋関数
 * yaml ライブラリを使用してフロントマターをパース
 * ジェネリック型パラメータで戻り値の型を指定可能
 */
export function parseFrontmatter<T extends Record<string, unknown> = Record<string, unknown>>(
  markdown: string,
): T | null {
  // フロントマターのパターンマッチング（空のフロントマターにも対応）
  const frontmatterRegex = /^---\n?([\s\S]*?)\n?---/;
  const match = markdown.match(frontmatterRegex);

  if (!match) {
    return null;
  }

  const frontmatterContent = match[1];

  // 空のフロントマターの場合は空オブジェクトを返す
  if (!frontmatterContent.trim()) {
    return {} as T;
  }

  try {
    // yamlライブラリを使用してパース
    const parsed = yamlParse(frontmatterContent.trim()) as unknown;
    // parseYamlがnullを返す場合は空オブジェクトを返す
    if (parsed === null) {
      return {} as T;
    }
    // オブジェクト型であることを確認
    if (typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as T;
    }
    // オブジェクト以外の場合はnullを返す
    return null;
  } catch {
    // パースに失敗した場合はnullを返す
    return null;
  }
}

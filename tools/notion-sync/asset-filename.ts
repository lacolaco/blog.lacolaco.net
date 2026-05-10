import { createHash } from 'node:crypto';

/**
 * Notion CDN URL とブロック ID から、collision-resistant かつ URL/filesystem safe な
 * アセットファイル名を導出する。
 *
 * 画像 (getImageOutput) と動画 (getVideoOutput) で同じ規則のファイル名を生成するため
 * 共通化している。markdown に書く `src` (パス) と R2/ローカルに保存する `filePath` の
 * filename を完全一致させ、CDN のパスデコード挙動に依存しない 404-free な形にする。
 *
 * 規則:
 *   `{safeName}.{hash16}.{ext}`
 *
 * - safeName: NFC 正規化後 `[a-zA-Z0-9._-]` 以外を `_` に置換。空のときは blockId 先頭 8 文字。
 * - ext: NFC 正規化後 lowercase + `[a-zA-Z0-9-]` 以外を `_` に置換。拡張子なし URL は defaultExt。
 * - hash: blockId の sha256 先頭 16 文字 (同じ blockId は冪等、別 blockId は衝突しない)。
 *
 * 防御的処理:
 *   - 不正なパーセントエンコード (例: `%GH`) を含む URL でも sync 全体を止めないよう
 *     decodeURIComponent を try/catch で囲み、失敗時は raw segment にフォールバックする。
 *   - URL 末尾セグメント抽出に失敗 (空文字) した場合は blockId 短縮形を使い、結果が
 *     `.{hash}.{ext}` のようなドット始まりにならないようにする。
 */
export function deriveAssetFilename(url: string, blockId: string, defaultExt: string): string {
  const rawSegment = url.split('?')[0].split('#')[0].split('/').pop() ?? '';
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawSegment);
  } catch {
    decoded = rawSegment;
  }
  const nfcFilename = decoded.normalize('NFC');
  const dotIndex = nfcFilename.lastIndexOf('.');
  const rawName = dotIndex > 0 ? nfcFilename.substring(0, dotIndex) : nfcFilename;
  const rawExt = dotIndex > 0 ? nfcFilename.substring(dotIndex + 1).toLowerCase() : defaultExt;
  const safeName = (rawName || blockId.substring(0, 8)).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = rawExt.replace(/[^a-zA-Z0-9-]/g, '_');
  const hash = createHash('sha256').update(blockId).digest('hex').substring(0, 16);
  return `${safeName}.${hash}.${ext}`;
}

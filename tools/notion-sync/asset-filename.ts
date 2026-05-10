import { createHash } from 'node:crypto';

// Image / video 共通のファイル名導出。R2 キーと markdown の src で完全一致する filename を作り、
// CDN のパスデコード挙動に依存しない 404-free な形にする。blockId hash で重複排除。
export function deriveAssetFilename(url: string, blockId: string, defaultExt: string): string {
  const rawSegment = url.split('?')[0].split('#')[0].split('/').pop() ?? '';
  // 不正なパーセントエンコード (例: '%GH') を含む URL でも sync 全体を止めないよう防御
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
  // rawName 空時は `.{hash}.{ext}` のドット始まりを避けるため blockId 短縮形へフォールバック
  const safeName = (rawName || blockId.substring(0, 8)).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = rawExt.replace(/[^a-zA-Z0-9-]/g, '_');
  const hash = createHash('sha256').update(blockId).digest('hex').substring(0, 16);
  return `${safeName}.${hash}.${ext}`;
}

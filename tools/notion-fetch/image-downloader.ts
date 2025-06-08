import { FileSystem } from './filesystem';

/**
 * 画像ダウンロードタスクの型定義
 */
export interface ImageDownloadTask {
  /** ダウンロード後のファイル名 */
  filename: string;
  /** ダウンロード元のURL */
  url: string;
}

/**
 * 指定されたスラッグディレクトリに画像を並列ダウンロードする
 *
 * この関数は以下の処理を行います：
 * 1. スラッグディレクトリの事前削除（既存画像をクリーンアップ）
 * 2. 指定された画像URLから並列ダウンロード
 * 3. 各画像をスラッグ別ディレクトリに保存
 * 4. ダウンロード進捗をコンソールに出力
 *
 * @param imageDownloads - ダウンロードする画像の配列
 * @param filesystem - ファイル操作用のFileSystemインスタンス
 * @param slug - 画像を保存するスラッグディレクトリ名
 * @throws ダウンロードに失敗した場合はエラーを投げる
 *
 * @example
 * ```typescript
 * const tasks = [
 *   { filename: 'image1.png', url: 'https://example.com/image1.png' },
 *   { filename: 'image2.jpg', url: 'https://example.com/image2.jpg' }
 * ];
 * await downloadImages(tasks, filesystem, 'my-blog-post');
 * // 結果: public/images/my-blog-post/image1.png, public/images/my-blog-post/image2.jpg
 * ```
 */
export async function downloadImages(
  imageDownloads: ImageDownloadTask[],
  filesystem: FileSystem,
  slug: string,
): Promise<void> {
  if (imageDownloads.length === 0) {
    return;
  }

  // Clean up the slug directory before downloading
  await filesystem.remove(slug);

  console.log(`Downloading ${imageDownloads.length} images...`);

  await Promise.all(
    imageDownloads.map(async ({ filename, url }) => {
      try {
        console.log(`Downloading ${filename} from ${url}`);
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
        }

        const buffer = await response.arrayBuffer();
        await filesystem.save(`${slug}/${filename}`, new Uint8Array(buffer));

        console.log(`Downloaded ${filename} to ${slug}/${filename}`);
      } catch (error) {
        console.error(`Failed to download ${filename}:`, error);
        throw error;
      }
    }),
  );

  console.log(`Downloaded ${imageDownloads.length} images`);
}

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import * as path from 'node:path';
import { packageDirectory } from 'pkg-dir';
import { PageContent, PageObject } from './notion-types';

export type CacheManifest = {
  [key: string]: string;
};

export class NotionPageCache {
  constructor(
    private readonly cacheDir: string,
    private readonly key: string,
  ) {}

  get manifestFilePath(): string {
    return path.resolve(this.cacheDir, `${this.key}.manifest.json`);
  }

  async getPageContent(page: PageObject): Promise<PageContent> {
    const filepath = path.resolve(this.cacheDir, page.id + '.json');
    const content = await readFile(filepath, 'utf-8')
      .then((s) => JSON.parse(s))
      .catch(() => null);
    if (!content) {
      throw new Error(`Failed to read cache file: ${filepath}`);
    }
    return content;
  }

  async savePageContent(page: PageObject, content: PageContent): Promise<void> {
    const filepath = path.resolve(this.cacheDir, page.id + '.json');
    await writeFile(filepath, JSON.stringify(content), 'utf-8');
  }

  async readManifest(): Promise<CacheManifest> {
    return readFile(this.manifestFilePath, 'utf-8')
      .then((data) => JSON.parse(data))
      .catch(() => ({}));
  }

  async writeManifest(manifest: CacheManifest): Promise<void> {
    return writeFile(this.manifestFilePath, JSON.stringify(manifest, null, 2), 'utf-8');
  }
}

export async function findCacheDir(key: string): Promise<string> {
  const pkgDir = await packageDirectory();
  if (!pkgDir) {
    throw new Error('Package directory not found');
  }
  const dir = path.resolve(pkgDir, '.cache', key);
  await mkdir(dir, { recursive: true });
  return dir;
}

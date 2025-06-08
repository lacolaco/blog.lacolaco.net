import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

type WriteFileData = Parameters<typeof writeFile>[1];
type WriteFileOptions = Parameters<typeof writeFile>[2];
type ReadFileResult = Awaited<ReturnType<typeof readFile>>;

export class FileSystem {
  constructor(
    private readonly root: string,
    private readonly base: string,
    private readonly options: { dryRun?: boolean } = {},
  ) {}

  private get dir() {
    return path.resolve(this.root, this.base);
  }

  async save(filename: string, data: WriteFileData, writeFileOptions?: WriteFileOptions) {
    if (this.options.dryRun) {
      return;
    }
    const filePath = path.resolve(this.dir, filename);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data, writeFileOptions);
  }

  async load(filename: string): Promise<ReadFileResult | null> {
    const filePath = path.resolve(this.dir, filename);
    try {
      return await readFile(filePath);
    } catch {
      return null;
    }
  }

  async remove(target: string) {
    if (this.options.dryRun) {
      return;
    }
    const dirPath = path.resolve(this.dir, target);
    await rm(dirPath, { recursive: true, force: true });
  }

  resolveLocalPathFromRoot(filename: string): string {
    return `/${path.relative(this.root, path.resolve(this.dir, filename))}`;
  }
}

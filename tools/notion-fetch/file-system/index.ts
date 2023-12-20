import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

type WriteFileData = Parameters<typeof writeFile>[1];
type WriteFileOptions = Parameters<typeof writeFile>[2];
type ReadFileResult = Awaited<ReturnType<typeof readFile>>;

export class FileSystem {
  constructor(
    private readonly rootDir: string,
    private readonly options: { dryRun?: boolean } = {},
  ) {}

  async save(filename: string, data: WriteFileData, writeFileOptions?: WriteFileOptions) {
    if (this.options.dryRun) {
      return;
    }
    const filePath = path.resolve(this.rootDir, filename);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, data, writeFileOptions);
  }

  async load(filename: string): Promise<ReadFileResult | null> {
    const filePath = path.resolve(this.rootDir, filename);
    try {
      return await readFile(filePath);
    } catch (e) {
      return null;
    }
  }

  async remove(target: string) {
    if (this.options.dryRun) {
      return;
    }
    const dirPath = path.resolve(this.rootDir, target);
    await rm(dirPath, { recursive: true });
  }
}

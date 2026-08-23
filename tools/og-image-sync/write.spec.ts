import { strict as assert } from 'node:assert';
import { test, describe, type TestContext } from 'node:test';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeRenderedImages } from './write.ts';
import type { OgImageTarget } from './discover.ts';

describe('writeRenderedImages', () => {
  function createOutputDir(t: TestContext): string {
    const dir = mkdtempSync(join(tmpdir(), 'og-write-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    return dir;
  }

  function createTarget(fileName: string): OgImageTarget {
    return {
      slug: fileName.split('.')[0],
      locale: 'ja',
      title: 'a',
      publishedDate: new Date('2026-01-01T00:00:00.000Z'),
      fileName,
      filePath: `content/notion/posts/${fileName}`,
    };
  }

  // 返す数は報告に使われる。書けた数と食い違うと、送る前の突き合わせが意味を失う
  test('書けた数を返す', async (t: TestContext) => {
    const outputDir = createOutputDir(t);
    const targets = [createTarget('a.ja.1.png'), createTarget('b.ja.2.png')];

    const written = await writeRenderedImages(targets, outputDir, () => Promise.resolve(Buffer.from('x')));

    assert.equal(written, targets.length);
    assert.deepEqual(readdirSync(outputDir).sort(), ['a.ja.1.png', 'b.ja.2.png']);
  });

  // 描いた時点で知らせると、書き込みが落ちた回に存在しないファイルの行がログに残る
  test('書けなかったものは知らせない', async (t: TestContext) => {
    const outputDir = createOutputDir(t);
    const targets = [createTarget('a.ja.1.png'), createTarget('b.ja.2.png')];
    const notified: string[] = [];

    await assert.rejects(() =>
      writeRenderedImages(
        targets,
        // 2件目の書き込みだけ落とす。出力先を消しても writeFile は失敗する
        outputDir,
        (_target, index) => {
          if (index === 1) rmSync(outputDir, { recursive: true, force: true });
          return Promise.resolve(Buffer.from('x'));
        },
        (target) => notified.push(target.fileName),
      ),
    );

    assert.deepEqual(notified, ['a.ja.1.png']);
  });

  // 途中で落ちた回に数だけ揃うと、欠けたまま送られる
  test('途中で落ちたら数を返さない', async (t: TestContext) => {
    const outputDir = createOutputDir(t);
    const targets = [createTarget('a.ja.1.png'), createTarget('b.ja.2.png')];

    await assert.rejects(() =>
      writeRenderedImages(targets, outputDir, (_target, index) =>
        index === 1 ? Promise.reject(new Error('描けない')) : Promise.resolve(Buffer.from('x')),
      ),
    );

    assert.deepEqual(readdirSync(outputDir), ['a.ja.1.png']);
  });

  test('対象がなければ0を返す', async (t: TestContext) => {
    const outputDir = createOutputDir(t);

    assert.equal(await writeRenderedImages([], outputDir, () => Promise.reject(new Error('呼ばれない'))), 0);
  });
});

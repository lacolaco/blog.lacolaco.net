import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import {
  computeOgImageHash,
  computeOgImageHashFromFile,
  computeRendererFingerprint,
  buildOgImageFileName,
  RENDERER_SOURCE_FILES,
  RENDERER_DEPENDENCIES,
} from './hash';

const markdown = '---\ntitle: テスト記事\n---\n\n本文である。\n';
const fingerprint = 'ffffffffffffffff';

const createdDirs: string[] = [];

afterEach(() => {
  for (const dir of createdDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

/** テスト終了時に片付ける一時ディレクトリを作る */
function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  createdDirs.push(dir);
  return dir;
}

/** レンダラ実装ファイル群と、依存の解決済みバージョンを持つ擬似プロジェクトルートを作る */
function createFakeRoot(): string {
  const root = createTempDir('og-root-');
  for (const rel of RENDERER_SOURCE_FILES) {
    const path = join(root, rel);
    mkdirSync(dirname(path), { recursive: true });
    cpSync(join(process.cwd(), rel), path);
  }
  writeLockfile(root, defaultVersions());
  return root;
}

function writeLockfile(
  rootDir: string,
  versions: Record<string, string>,
  options: { section?: string; snapshots?: Record<string, unknown> } = {},
): void {
  const declared = Object.fromEntries(
    Object.entries(versions).map(([name, version]) => [name, { specifier: `^${version}`, version }]),
  );
  const snapshots =
    options.snapshots ??
    Object.fromEntries(Object.entries(versions).map(([name, version]) => [`${name}@${version}`, { dependencies: {} }]));
  writeFileSync(
    join(rootDir, 'pnpm-lock.yaml'),
    stringifyYaml({ importers: { '.': { [options.section ?? 'dependencies']: declared } }, snapshots }),
    'utf8',
  );
}

function defaultVersions(): Record<string, string> {
  return Object.fromEntries(RENDERER_DEPENDENCIES.map((name) => [name, '1.0.0']));
}

describe('computeOgImageHash', () => {
  // ビルド時 (og:image のURL組み立て) とCI (画像生成) で同じ値になる必要がある
  it('同じmarkdownと同じfingerprintなら同じhashを返す', () => {
    expect(computeOgImageHash(markdown, fingerprint)).toBe(computeOgImageHash(markdown, fingerprint));
  });

  it('markdownが変わればhashが変わる', () => {
    expect(computeOgImageHash(markdown, fingerprint)).not.toBe(computeOgImageHash(`${markdown}追記。\n`, fingerprint));
  });

  it('fingerprintが変わればhashが変わる', () => {
    expect(computeOgImageHash(markdown, fingerprint)).not.toBe(computeOgImageHash(markdown, '0000000000000000'));
  });

  // 既存の画像ファイル (image.c2f096b42f92d4ef.png 等) と同じ16桁hexに揃える
  it('16桁の小文字hexを返す', () => {
    expect(computeOgImageHash(markdown, fingerprint)).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('computeRendererFingerprint', () => {
  it('16桁の小文字hexを返す', () => {
    expect(computeRendererFingerprint()).toMatch(/^[0-9a-f]{16}$/);
  });

  it('同じ実装ファイル群なら同じ値を返す', () => {
    const root = createFakeRoot();
    expect(computeRendererFingerprint(root)).toBe(computeRendererFingerprint(root));
  });

  // 手動でバージョンを上げ忘れても、実装を変えれば必ず再生成が走ることを担保する
  it.each(RENDERER_SOURCE_FILES)('%s を変更するとfingerprintが変わる', (target) => {
    const root = createFakeRoot();
    const before = computeRendererFingerprint(root);
    writeFileSync(join(root, target), 'changed');

    expect(computeRendererFingerprint(root)).not.toBe(before);
  });

  // 描画に使う依存のバージョンが変わるとグリフ配置が変わりうる。
  // package.json の宣言は caret レンジを含むため、lockfileの解決済みバージョンを見る必要がある
  it.each(RENDERER_DEPENDENCIES)('%s の解決済みバージョンが変わるとfingerprintが変わる', (name) => {
    const root = createFakeRoot();
    const before = computeRendererFingerprint(root);
    writeLockfile(root, { ...defaultVersions(), [name]: '1.0.1' });

    expect(computeRendererFingerprint(root)).not.toBe(before);
  });

  // satori 等はレイアウトエンジンを推移的依存に持つため、自身のバージョンが動かなくても描画が変わる
  it.each(RENDERER_DEPENDENCIES)('%s の推移的依存が変わるとfingerprintが変わる', (name) => {
    const root = createFakeRoot();
    const before = computeRendererFingerprint(root);
    const versions = defaultVersions();
    const snapshots = Object.fromEntries(
      Object.entries(versions).map(([dep, version]) => [
        `${dep}@${version}`,
        { dependencies: dep === name ? { 'yoga-layout': '3.2.2' } : {} },
      ]),
    );
    writeLockfile(root, versions, { snapshots });

    expect(computeRendererFingerprint(root)).not.toBe(before);
  });

  // ビルド時にしか使わない依存は devDependencies に移されうる。宣言セクションで結果が変わってはいけない
  it.each(['devDependencies', 'optionalDependencies'])('%s で宣言された依存も読める', (section) => {
    const root = createFakeRoot();
    const before = computeRendererFingerprint(root);
    writeLockfile(root, defaultVersions(), { section });

    expect(computeRendererFingerprint(root)).toBe(before);
  });

  // 内容が同一なら別ディレクトリでも同じ値でなければならない (キャッシュ衝突の検出)
  it('内容が同一の別のrootDirでは同じ値を返す', () => {
    expect(computeRendererFingerprint(createFakeRoot())).toBe(computeRendererFingerprint(createFakeRoot()));
  });

  // 同じrootDirで実装を編集したとき、キャッシュが古い値を返してはいけない
  it('同じrootDirでも実装を編集すれば新しい値を返す', () => {
    const root = createFakeRoot();
    const before = computeRendererFingerprint(root);
    writeFileSync(join(root, RENDERER_SOURCE_FILES[0]), 'changed');

    expect(computeRendererFingerprint(root)).not.toBe(before);
  });

  // 握りつぶすと依存の更新を検知できず、古い描画が永久に配信され続ける
  it('lockfileの構造が想定と違うとエラーになる', () => {
    const root = createFakeRoot();
    writeFileSync(join(root, 'pnpm-lock.yaml'), stringifyYaml({ lockfileVersion: '9.0' }), 'utf8');

    expect(() => computeRendererFingerprint(root)).toThrow();
  });

  // 握りつぶすと推移的依存への感度を失ったまま気付けない
  it('lockfileにsnapshotsがないとエラーになる', () => {
    const root = createFakeRoot();
    writeLockfile(root, defaultVersions(), { snapshots: {} });

    expect(() => computeRendererFingerprint(root)).toThrow(/snapshots/);
  });

  it.each(RENDERER_DEPENDENCIES)('lockfileに %s がないとエラーになる', (missing) => {
    const root = createFakeRoot();
    const versions = Object.fromEntries(
      RENDERER_DEPENDENCIES.filter((dep) => dep !== missing).map((dep) => [dep, '1.0.0']),
    );
    writeLockfile(root, versions);

    expect(() => computeRendererFingerprint(root)).toThrow(missing);
  });
});

describe('computeOgImageHashFromFile', () => {
  // ビルド時とCIが「同じファイルの全文」以外を入力にできないことがこの関数の存在理由
  it('ファイル全文をそのまま入力としたhashと一致する', () => {
    const dir = createTempDir('og-hash-');
    const filePath = join(dir, 'post.md');
    writeFileSync(filePath, markdown, 'utf8');

    expect(computeOgImageHashFromFile(filePath)).toBe(computeOgImageHash(markdown, computeRendererFingerprint()));
  });

  // frontmatter に title があるため、本文だけを入力にするとタイトル変更が反映されない
  it('frontmatterのtitleだけが違うファイルで異なるhashになる', () => {
    const dir = createTempDir('og-hash-');
    const a = join(dir, 'a.md');
    const b = join(dir, 'b.md');
    writeFileSync(a, "---\ntitle: '古いタイトル'\n---\n\n本文である。\n", 'utf8');
    writeFileSync(b, "---\ntitle: '新しいタイトル'\n---\n\n本文である。\n", 'utf8');

    expect(computeOgImageHashFromFile(a)).not.toBe(computeOgImageHashFromFile(b));
  });
});

describe('buildOgImageFileName', () => {
  it('slug.locale.hash.png 形式のファイル名を組み立てる', () => {
    expect(buildOgImageFileName('my-post', 'ja', 'c2f096b42f92d4ef')).toBe('my-post.ja.c2f096b42f92d4ef.png');
  });

  // ja と en は同じ slug を共有するため、locale がないとR2上でどちらの言語版か判別できない
  it('slugが同じでもlocaleが違えば別のファイル名になる', () => {
    const hash = 'c2f096b42f92d4ef';

    expect(buildOgImageFileName('my-post', 'ja', hash)).not.toBe(buildOgImageFileName('my-post', 'en', hash));
  });
});

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { z } from 'zod';
import { resolveCanonicalUrl } from './canonical';

const site = 'https://blog.lacolaco.net';
const Frontmatter = z.object({ slug: z.string(), canonical_url: z.string().optional() });

describe('resolveCanonicalUrl', () => {
  it.each([
    {
      name: '英語と zenn.dev: 自身の URL にする',
      locale: 'en',
      canonicalUrl: 'https://zenn.dev/lacolaco/articles/foo',
      expected: 'https://blog.lacolaco.net/posts/foo.en/',
    },
    {
      name: '英語と未設定: 自身の URL にする',
      locale: 'en',
      canonicalUrl: undefined,
      expected: 'https://blog.lacolaco.net/posts/foo.en/',
    },
    {
      name: '日本語と zenn.dev: canonical_url をそのまま使う',
      locale: 'ja',
      canonicalUrl: 'https://zenn.dev/lacolaco/articles/foo',
      expected: 'https://zenn.dev/lacolaco/articles/foo',
    },
    {
      name: '日本語と未設定: 出さない',
      locale: 'ja',
      canonicalUrl: undefined,
      expected: undefined,
    },
    {
      name: '日本語とはてなブログ: canonical_url をそのまま使う',
      locale: 'ja',
      canonicalUrl: 'https://lacolaco.hatenablog.com/entry/foo',
      expected: 'https://lacolaco.hatenablog.com/entry/foo',
    },
    {
      name: 'locale 未設定は日本語として扱う',
      locale: undefined,
      canonicalUrl: undefined,
      expected: undefined,
    },
  ])('$name', ({ locale, canonicalUrl, expected }) => {
    expect(resolveCanonicalUrl({ slug: 'foo', locale, canonicalUrl, site })).toBe(expected);
  });
});

function listEnglishPostFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.en.md'))
    .map((file) => join(dir, file));
}

describe('content の英語の記事', () => {
  const files = listEnglishPostFiles(join(process.cwd(), 'content'));

  it('英語の記事が1件以上ある', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((file) => [file]))('%s の canonical が外部ホストを指さない', (file) => {
    const frontmatter = Frontmatter.parse(parse(readFileSync(file, 'utf8').split(/^---$/m)[1]) as unknown);
    const canonical = resolveCanonicalUrl({
      slug: frontmatter.slug,
      locale: 'en',
      canonicalUrl: frontmatter.canonical_url,
      site,
    });
    expect(new URL(canonical!).host).toBe('blog.lacolaco.net');
  });
});

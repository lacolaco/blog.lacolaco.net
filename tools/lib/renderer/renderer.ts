import { format } from 'prettier';
import type { FileSystem } from '../file-system';
import type { BlockObject, PageObjectWithContent } from '../notion';
import { getFile } from './utils';
import { renderFrontmatter } from './frontmatter';
import { renderBlock } from './markdown';
import type { RenderContext, RenderResult } from './types';
import { featureComponents } from './features';

const imagesRootPath = '/images';

export async function renderPosts(pages: PageObjectWithContent[], imagesFS: FileSystem): Promise<RenderResult[]> {
  return Promise.all(pages.map((page) => renderPost(page, imagesFS)));
}

export async function renderPost(page: PageObjectWithContent, imagesFS: FileSystem): Promise<RenderResult> {
  console.log(`rendering ${page.slug}`);
  const context: RenderContext = {
    imagesBasePath: `${imagesRootPath}/${page.slug}`,
    imageRequests: [],
    features: new Set(),
  };

  const title = page.properties.title.title[0].plain_text;
  const published = page.properties.published.checkbox;
  const tags = page.properties.tags.multi_select.map((tag) => tag.name);
  const createdAtOverride = page.properties.created_at_override?.date?.start ?? null;
  const date = new Date(createdAtOverride ?? page.created_time).toISOString();
  const updatedAt = page.properties.updated_at?.date?.start ?? undefined;
  const canonicalUrl = page.properties.canonical_url?.url ?? undefined;
  const source = page.url;

  const frontmatter = renderFrontmatter({
    title,
    date,
    updatedAt,
    tags,
    published,
    source,
    canonicalUrl,
  });
  const body = await renderContent(page.content, context);
  const featureImports = Array.from(context.features)
    .map((f) => featureComponents[f])
    .map((c) => `import ${c} from '../../components/features/${c}.astro';`)
    .join('\n');

  const content = format([frontmatter, featureImports, body].join('\n\n'), {
    parser: 'mdx',
    printWidth: 120,
    singleQuote: true,
    trailingComma: 'all',
  });
  await Promise.all(
    context.imageRequests.map(async (req) => {
      const data = await getFile(req.url);
      await imagesFS.save(`${page.slug}/${req.filename}`, data);
    })
  );

  return {
    filename: `${page.slug}.mdx`,
    content,
  };
}

async function renderContent(blocks: BlockObject[], context: RenderContext): Promise<string> {
  return (await Promise.all(blocks.map((block) => renderBlock(block, context)))).join('');
}

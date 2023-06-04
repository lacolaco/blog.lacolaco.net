import { PageObjectWithContent } from '@lib/notion';
import { PostData } from '@lib/post';
import { FileSystem } from '../file-system';
import { newContentTransformer } from './transform';

export async function toBlogPostJSON(page: PageObjectWithContent, imageFS: FileSystem): Promise<PostData> {
  const { id: pageId, last_edited_time: lastEditedAt, created_time, slug, properties } = page;
  const transformer = newContentTransformer(page, imageFS);

  const title = transformer.transformTitle(properties.title);
  const createdAtOverride = properties.created_at_override?.date?.start ?? null;
  const date = new Date(createdAtOverride ?? created_time);
  const tags = properties.tags.multi_select.map((tag) => tag.name);
  const updatedAtOverride = properties.updated_at?.date?.start ?? undefined;
  const updatedAt = updatedAtOverride ? new Date(updatedAtOverride) : undefined;
  const canonicalUrl = properties.canonical_url?.url ?? undefined;
  const content = await transformer.transformContent(page.content);

  return {
    pageId,
    lastEditedAt,
    slug,
    properties: { title, date, tags, updatedAt, canonicalUrl },
    content,
  };
}

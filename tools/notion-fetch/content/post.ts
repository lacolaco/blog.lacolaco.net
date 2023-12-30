import { PageObjectWithContent } from '@lib/notion';
import { PostData, postSchema } from '@lib/post';
import { FileSystem } from '../file-system';
import { newContentTransformer } from './transform';

export async function toBlogPostJSON(page: PageObjectWithContent, imageFS: FileSystem): Promise<PostData> {
  const { id: pageId, last_edited_time: lastEditedAt, created_time, slug, locale, properties } = page;
  const transformer = newContentTransformer(page, imageFS);

  const title = transformer.transformTitle(properties.title);
  const createdAtOverride = properties.created_at_override?.date?.start ?? null;
  const date = new Date(createdAtOverride ?? created_time);
  const category = properties.category.select?.name;
  const tags = properties.tags.multi_select.map((tag) => tag.name);
  const updatedAtOverride = properties.updated_at?.date?.start ?? undefined;
  const updatedAt = updatedAtOverride ? new Date(updatedAtOverride) : undefined;
  const canonicalUrl = properties.canonical_url?.url ?? undefined;
  const content = await transformer.transformContent(page.content);

  return postSchema.parse({
    pageId,
    lastEditedAt,
    slug,
    locale,
    properties: { title, date, category, tags, updatedAt, canonicalUrl },
    content,
  });
}

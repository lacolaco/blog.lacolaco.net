import type { Client } from '@notionhq/client';
import { createHash } from 'node:crypto';
import type { BlockObject, DatabasePropertyConfigs, PageObject, PageProperty, QueryFilterObject } from './types';

/**
 * If the page has slug property, return it.
 * Otherwise, return generated slug made from page's id.
 */
export function getSlug(page: PageObject): string {
  const { slug } = page.properties as { slug?: PageProperty<'rich_text'> };
  if (slug && slug.rich_text.length > 0 && slug.rich_text[0].plain_text.length > 0) {
    return slug.rich_text[0].plain_text;
  }
  // generate 12-length-hex slug from page id
  return createHash('sha1').update(page.id).digest('hex').slice(0, 12);
}

export function getLocale(page: PageObject): string | undefined {
  const { locale } = page.properties as { locale?: PageProperty<'select'> };
  if (locale && locale.select) {
    return locale.select.name;
  }
  return undefined;
}

export async function queryAllPages(
  client: Client,
  databaseId: string,
  filter: QueryFilterObject,
): Promise<PageObject[]> {
  const pages: PageObject[] = [];
  let cursor = null;
  do {
    const { results, next_cursor, has_more } = await client.databases.query({
      database_id: databaseId,
      archived: false,
      filter,
      page_size: 100,
      start_cursor: cursor ?? undefined,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    });
    for (const page of results) {
      if ('properties' in page) {
        pages.push(page as PageObject);
      }
    }
    cursor = has_more ? next_cursor : null;
  } while (cursor !== null);
  return pages;
}

export async function fetchChildBlocks(client: Client, parentId: string): Promise<BlockObject[]> {
  const blocks: BlockObject[] = [];
  let cursor = null;
  do {
    const { results, next_cursor, has_more } = await client.blocks.children.list({
      block_id: parentId,
      page_size: 100,
      start_cursor: cursor ?? undefined,
    });
    for (const block of results) {
      if ('type' in block) {
        if (block.has_children) {
          const children = await fetchChildBlocks(client, block.id);
          blocks.push({ ...block, children });
        } else {
          blocks.push({ ...block });
        }
      }
    }
    cursor = has_more ? next_cursor : null;
  } while (cursor !== null);
  return blocks;
}

export async function fetchDatabaseProperties(client: Client, databaseId: string): Promise<DatabasePropertyConfigs> {
  const { properties } = await client.databases.retrieve({
    database_id: databaseId,
  });
  return properties;
}

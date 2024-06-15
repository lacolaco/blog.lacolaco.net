import type { Client } from '@notionhq/client';
import type { BlockObject, DatabasePropertyConfigs, PageObject, QueryFilterObject } from './notion-types';

export async function queryAllPages<T extends PageObject>(
  client: Client,
  databaseId: string,
  filter: QueryFilterObject,
): Promise<T[]> {
  const pages: T[] = [];
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
        pages.push(page as T);
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

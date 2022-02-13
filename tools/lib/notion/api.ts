import { Client } from '@notionhq/client';
import { BlockObject, PageObject } from './types';

export class NotionAPI {
  constructor(private readonly client: Client) {}

  async queryAllPages(databaseId: string): Promise<PageObject[]> {
    const pages: PageObject[] = [];
    let cursor = null;
    do {
      const { results, next_cursor, has_more } = await this.client.databases.query({
        database_id: databaseId,
        sorts: [{ timestamp: 'created_time', direction: 'descending' }],
      });
      for (const page of results) {
        if ('properties' in page) {
          pages.push(page);
        }
      }
      cursor = has_more ? next_cursor : null;
    } while (cursor !== null);
    return pages;
  }

  async fetchChildBlocks(parentId: string, depth = 0): Promise<BlockObject[]> {
    const blocks: BlockObject[] = [];
    let cursor = null;
    do {
      const { results, next_cursor, has_more } = await this.client.blocks.children.list({
        block_id: parentId,
      });
      for (const block of results) {
        if ('type' in block) {
          if (block.has_children) {
            const children = await this.fetchChildBlocks(block.id, depth + 1);
            blocks.push({ ...block, depth, children });
          } else {
            blocks.push({ ...block, depth });
          }
        }
      }
      cursor = has_more ? next_cursor : null;
    } while (cursor !== null);
    return blocks;
  }
}

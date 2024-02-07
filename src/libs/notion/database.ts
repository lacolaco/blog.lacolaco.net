import { Client } from '@notionhq/client';
import type { BlogDatabaseProperties } from './types';
import { fetchDatabaseProperties } from './utils';

export class NotionDatabase {
  private notion = new Client({ auth: this.authToken });

  constructor(
    private authToken: string,
    private databaseID: string,
  ) {}

  async getDatabaseProperties(): Promise<BlogDatabaseProperties> {
    const properties = await fetchDatabaseProperties(this.notion, this.databaseID);
    return properties as BlogDatabaseProperties;
  }
}

import axios from 'axios';
import * as esa from './types';

export class Esa {
  constructor(private teamName: string, private accessToken: string) {}

  async posts(
    query: string,
    sort: 'updated' | 'created' = 'updated',
    pagination: esa.PaginationParams = { page: 1, per_page: 20 }
  ): Promise<esa.PostsResponse> {
    const { data } = await axios(
      `https://api.esa.io/v1/teams/${this.teamName}/posts`,
      {
        params: {
          access_token: this.accessToken,
          q: query,
          sort,
          ...pagination
        }
      }
    );
    return data;
  }
}

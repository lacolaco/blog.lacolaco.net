import { format } from 'prettier';

export async function formatJSON(data: unknown) {
  return await format(JSON.stringify(data, null, 2), {
    parser: 'json',
  });
}

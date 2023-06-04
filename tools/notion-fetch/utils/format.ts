import { format } from 'prettier';

export function formatJSON(data: unknown) {
  return format(JSON.stringify(data, null, 2), {
    parser: 'json',
  });
}

import { Category } from '../post/schema';
import { categories } from '../post/properties';

export async function queryCategories(): Promise<Category[]> {
  return Object.values(categories);
}

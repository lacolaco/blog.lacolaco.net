import { Category } from '../post/schema';
import { categories } from '../post/properties';

export function queryCategories(): Category[] {
  return categories;
}

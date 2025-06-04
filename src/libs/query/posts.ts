import { getCollection } from 'astro:content';
import { compareDesc, isPast } from 'date-fns';
import { type PostData } from '../post/schema';

const isDevMode = import.meta.env.MODE === 'development';

export async function queryPosts(): Promise<PostData[]> {
  const posts = await getCollection('post');
  const availablePosts = isDevMode ? posts : posts.filter((post) => isPast(post.data.properties.date));
  return availablePosts.map((post) => post.data).sort((a, b) => compareDesc(a.properties.date, b.properties.date));
}

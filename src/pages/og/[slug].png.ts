import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { cacheImage, getCachedImage } from '../../libs/og-image/cache';
import { generateOgImage } from '../../libs/og-image/generate';

export const prerender = false;

export async function GET({ params }: APIContext) {
  const { slug } = params;
  if (!slug) return { status: 404 };

  const post = (await queryAvailablePosts()).find((post) => post.data.slug === slug);
  if (!post) return { status: 404 };

  const title = post.data.title;

  try {
    const cachedImage = await getCachedImage(slug, title);
    if (cachedImage) {
      console.debug(`Found cached image for slug: ${slug}, title: ${title}`);

      return new Response(new Uint8Array(cachedImage).buffer, {
        headers: {
          'content-type': 'image/png',
          // Cache for 1 hour and revalidate every hour
          'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600',
        },
      });
    }
  } catch (error) {
    console.error(`Error checking cache for slug: ${slug}, title: ${title}`, error);
    // fall through to generate the image
  }

  try {
    const pngBuffer = await generateOgImage({ slug, title });
    // Upload the image to GCS
    await cacheImage(slug, title, pngBuffer);
    console.debug(`Cached image for slug: ${slug}, title: ${title}`);

    return new Response(new Uint8Array(pngBuffer).buffer, {
      headers: {
        'content-type': 'image/png',
        // Cache for 1 hour and revalidate every hour
        'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(`Failed to generate OG image: ${errorMessage}`, { status: 500 });
  }
}

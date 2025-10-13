import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { generateOgImage } from '../../libs/og-image/generate';
import { cacheImage, getCachedImage } from '../../libs/og-image/cache';

// export async function getStaticPaths() {
//   const posts = await queryAvailablePosts();

//   return posts.map((post) => ({
//     params: {
//       slug: post.data.slug,
//     },
//   }));
// }

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
      // res.setHeader('Content-Type', 'image/png');
      // res.send(cachedImage);
      return new Response(cachedImage.buffer as ArrayBuffer, {
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

    return new Response(pngBuffer.buffer as ArrayBuffer, {
      headers: {
        'content-type': 'image/png',
        // Cache for 1 hour and revalidate every hour
        'cache-control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=3600',
      },
    });
  } catch (error) {
    return new Response(`Failed to generate OG image: ${error}`, { status: 500 });
  }
}

import { queryAvailablePosts } from '@lib/query';
import type { APIContext } from 'astro';
import { generateOgImage } from '../../libs/og-image/generate';

export const prerender = false;

export async function GET({ params }: APIContext) {
  const { slug } = params;
  if (!slug) return new Response(null, { status: 404 });

  const post = (await queryAvailablePosts()).find((post) => post.data.slug === slug);
  if (!post) return new Response(null, { status: 404 });

  const title = post.data.title;

  try {
    const pngBuffer = await generateOgImage({ slug, title });
    return new Response(new Uint8Array(pngBuffer).buffer, {
      headers: {
        'content-type': 'image/png',
        // Cloudflare CDNがCache-Controlヘッダーに基づいてエッジでキャッシュする
        // クエリパラメータ（last_edited_time）でキャッシュ無効化するため、長期キャッシュが可能
        'cache-control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(`Failed to generate OG image: ${errorMessage}`, { status: 500 });
  }
}

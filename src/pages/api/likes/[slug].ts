import type { APIContext } from 'astro';
import { getLikeStatus, toggleLike } from '../../../libs/likes';

export const prerender = false;

export async function GET(context: APIContext): Promise<Response> {
  const slug = context.params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
  }

  const clientId = new URL(context.request.url).searchParams.get('clientId') ?? undefined;

  try {
    const result = await getLikeStatus(slug, clientId);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}

export async function POST(context: APIContext): Promise<Response> {
  const slug = context.params.slug;
  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 });
  }

  let body: { clientId?: string };
  try {
    body = (await context.request.json()) as { clientId?: string };
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const { clientId } = body;
  if (!clientId || typeof clientId !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing clientId' }), { status: 400 });
  }

  try {
    const result = await toggleLike(slug, clientId);
    return new Response(JSON.stringify(result), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return new Response(JSON.stringify({ error: 'Rate limited' }), { status: 429 });
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}

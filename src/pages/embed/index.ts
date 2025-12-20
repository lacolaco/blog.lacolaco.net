import type { APIContext } from 'astro';
import escapeHtml from 'escape-html';
import { fetchPageMetadata, type PageMetadata } from '../../libs/embed/fetchPageMetadata';

export const prerender = false;

// 定数
const DEFAULT_CACHE_MAX_AGE = 60 * 60; // 1 hour

/**
 * `/embed` エンドポイントのハンドラー
 * このエンドポイントは、指定されたURLのメタデータを取得し、Webページカードとして埋め込むHTMLを生成します。
 * `url` パラメータで指定されたURLのメタデータを取得し、カード形式で表示します。
 *
 * @param context
 * @returns
 */
export async function GET(context: APIContext): Promise<Response> {
  const url = new URL(decodeURIComponent(context.request.url)).searchParams.get('url');
  if (!url) {
    return new Response('Missing url parameter', { status: 400 });
  }

  const metadata = await fetchPageMetadata(url);
  const html = buildEmbedHtml(metadata, url);

  return new Response(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': metadata.cacheControl || `max-age=${DEFAULT_CACHE_MAX_AGE}`,
    },
  });
}

function getEmbedStyles(): string {
  return `
    html, body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji';
    }

    .block-link {
      display: flex;
      margin: 0;
    }

    .webpage-card {
      display: flex;
      align-items: center;
      height: 5rem;
      gap: 1rem;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
      box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
      box-sizing: border-box;
      transition: box-shadow 200ms;
      background: #fff;
      text-decoration: none;
      color: inherit;
    }

    .webpage-card:hover {
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      text-decoration: underline;
    }

    .webpage-card-image {
      height: 100%;
      aspect-ratio: 16/9;
      flex-shrink: 0;
      object-fit: cover;
      display: none;
    }

    .webpage-card-content {
      display: flex;
      flex-direction: column;
      flex-grow: 1;
      overflow: hidden;
      padding: 1rem 1rem;
      gap: 0.5rem;
    }

    .webpage-card-title {
      margin: 0;
      font-size: 0.9rem;
      font-weight: 600;
      color: #111827;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .webpage-card-description {
      margin: 0;
      font-size: 0.8rem;
      color: #4b5563;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (min-width: 768px) {
      .webpage-card {
        height: 7rem;
      }

      .webpage-card-image {
        display: block;
      }
    }
  `;
}

function buildEmbedHtml(metadata: PageMetadata, url: string): string {
  const { title, imageUrl } = metadata;
  const displayDescription = new URL(url).hostname;

  return `<!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width" />
        <meta name="robots" content="noindex" />
        <title>${escapeHtml(title)}</title>
        <style>${getEmbedStyles()}</style>
      </head>
      <body>
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="block-link block-link-webpage webpage-card">
          <div class="webpage-card-content">
            <h3 class="webpage-card-title">${escapeHtml(title)}</h3>
            <p class="webpage-card-description">${escapeHtml(displayDescription)}</p>
          </div>
          ${imageUrl ? `<img src="${escapeHtml(imageUrl)}" alt="Page image" class="webpage-card-image">` : ''}
        </a>
      </body>
    </html>
  `;
}

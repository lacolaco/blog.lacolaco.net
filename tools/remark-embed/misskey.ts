import { escapeHtml } from './escape-html.ts';

type Json = Record<string, unknown>;

interface MisskeyFile {
  type: string;
  isSensitive: boolean;
  thumbnailUrl: string | null;
  url: string | null;
  width: number | null;
  height: number | null;
  comment: string | null;
}

interface MisskeyNote {
  id: string;
  createdAt: string;
  text: string | null;
  cw: string | null;
  visibility: string;
  renoteId: string | null;
  user: {
    name: string | null;
    username: string;
    host: string | null;
    avatarUrl: string | null;
    emojis: Record<string, string>;
  };
  files: MisskeyFile[];
  emojis: Record<string, string>;
}

// 'unavailable': 存在しない・見られない, 'unknown': 一時的エラーやMisskey以外
type NoteResult = { status: 'ok'; note: MisskeyNote } | { status: 'unavailable' } | { status: 'unknown' };

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value: unknown): string | null => (typeof value === 'string' ? value : null);
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

function asEmojiMap(value: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (!isObject(value)) return map;
  for (const [name, url] of Object.entries(value)) {
    if (typeof url === 'string') map[name] = url;
  }
  return map;
}

// notes/show の応答が note として扱える形かを検証して正規化する
function parseNote(value: unknown): MisskeyNote | undefined {
  if (!isObject(value) || !isObject(value.user)) return undefined;
  const id = asString(value.id);
  const createdAt = asString(value.createdAt);
  const visibility = asString(value.visibility);
  const username = asString(value.user.username);
  if (!id || !createdAt || !visibility || !username || Number.isNaN(Date.parse(createdAt))) return undefined;

  const files = Array.isArray(value.files) ? value.files.filter(isObject) : [];
  return {
    id,
    createdAt,
    text: asString(value.text),
    cw: asString(value.cw),
    visibility,
    renoteId: asString(value.renoteId),
    user: {
      name: asString(value.user.name),
      username,
      host: asString(value.user.host),
      avatarUrl: asString(value.user.avatarUrl),
      emojis: asEmojiMap(value.user.emojis),
    },
    files: files.map((file) => {
      const properties = isObject(file.properties) ? file.properties : {};
      return {
        type: asString(file.type) ?? '',
        isSensitive: file.isSensitive === true,
        thumbnailUrl: asString(file.thumbnailUrl),
        url: asString(file.url),
        width: asNumber(properties.width),
        height: asNumber(properties.height),
        comment: asString(file.comment),
      };
    }),
    emojis: asEmojiMap(value.emojis),
  };
}

// 応答しないホストでビルドが止まらないよう打ち切る
const REQUEST_TIMEOUT_MS = 10_000;

async function postJson(host: string, path: string, body: Json): Promise<Response> {
  return fetch(`https://${host}/api/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

// Misskey のエラー応答 ({ error: { code } }) か。Misskey 以外のサイトの 4xx と区別する
async function isMisskeyError(response: Response): Promise<boolean> {
  try {
    const body: unknown = await response.json();
    return isObject(body) && isObject(body.error) && typeof body.error.code === 'string';
  } catch {
    return false;
  }
}

async function fetchNote(host: string, noteId: string): Promise<NoteResult> {
  try {
    const response = await postJson(host, 'notes/show', { noteId });
    if (!response.ok) {
      // 400/403/404でMisskeyのエラー応答なら、ノートが存在しない、または見られない
      if ([400, 403, 404].includes(response.status) && (await isMisskeyError(response))) {
        return { status: 'unavailable' };
      }
      console.warn(`Misskey API returned ${response.status} for ${host}/notes/${noteId}`);
      return { status: 'unknown' };
    }
    const note = parseNote(await response.json());
    return note ? { status: 'ok', note } : { status: 'unknown' };
  } catch (error) {
    console.warn(`Misskey API fetch failed for ${host}/notes/${noteId}:`, error);
    return { status: 'unknown' };
  }
}

async function fetchServerIcon(host: string): Promise<string | undefined> {
  try {
    const response = await postJson(host, 'meta', {});
    if (!response.ok) return undefined;
    const meta: unknown = await response.json();
    return isObject(meta) ? (asString(meta.iconUrl) ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

async function fetchEmojiUrl(host: string, name: string): Promise<string | undefined> {
  try {
    const response = await postJson(host, 'emoji', { name });
    if (!response.ok) return undefined;
    const emoji: unknown = await response.json();
    return isObject(emoji) ? (asString(emoji.url) ?? undefined) : undefined;
  } catch {
    return undefined;
  }
}

// javascript: などを避けるため、http(s)のURLだけを通す
function safeUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

const EMOJI_PATTERN = /:([a-zA-Z0-9_+-]+):/g;

function collectEmojiNames(...texts: (string | null)[]): string[] {
  const names = new Set<string>();
  for (const text of texts) {
    for (const match of (text ?? '').matchAll(EMOJI_PATTERN)) names.add(match[1]);
  }
  return [...names];
}

// Cloudflare の Email Obfuscation が user@host (ユーザー名やメンション) を書き換えないよう、テキストの @ は文字参照にする
function escapeText(text: string): string {
  return escapeHtml(text).replace(/@/g, '&#64;');
}

// エスケープ済みテキストの :name: を画像に置換する。改行は &#10; にして pre-wrap で保持する
function renderText(text: string, emojiUrls: Map<string, string>): string {
  return escapeText(text.replace(/\r\n?/g, '\n'))
    .replace(EMOJI_PATTERN, (whole, name: string) => {
      const url = emojiUrls.get(name);
      return url ? `<img class="misskey-emoji" alt=":${name}:" src="${escapeHtml(url)}">` : whole;
    })
    .replace(/\n/g, '&#10;');
}

// JSTの絶対時刻 YYYY/MM/DD HH:mm
function formatJst(iso: string): string {
  const jst = new Date(Date.parse(iso) + 9 * 60 * 60 * 1000).toISOString();
  return `${jst.slice(0, 4)}/${jst.slice(5, 7)}/${jst.slice(8, 10)} ${jst.slice(11, 16)}`;
}

function externalLink(href: string, attrs: string, inner: string): string {
  return `<a ${attrs}href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>`;
}

function renderImages(files: MisskeyFile[]): string {
  const items = files.map((file) => {
    const src = safeUrl(file.thumbnailUrl ?? file.url);
    if (!src) return '';
    const size = file.width && file.height ? ` width="${file.width}" height="${file.height}"` : '';
    const full = safeUrl(file.url) ?? src;
    return `<div class="misskey-image"><img src="${escapeHtml(src)}" alt="${escapeHtml(file.comment ?? '')}"${size} loading="lazy" data-lightbox-src="${escapeHtml(full)}"></div>`;
  });
  const html = items.filter(Boolean);
  if (html.length === 0) return '';
  const single = html.length === 1 ? ' misskey-images-single' : '';
  return `<div class="misskey-images${single}">${html.join('')}</div>`;
}

function unavailablePlaceholder(url: string): string {
  const escaped = escapeHtml(url);
  return `
<div class="block-link block-link-misskey block-link-misskey-unavailable">
  <p>このノートは現在表示できません</p>
  <a href="${escaped}" target="_blank" rel="noopener noreferrer">${escaped}</a>
</div>`.trim();
}

/**
 * MisskeyのノートURLをカードHTMLにする。
 * カードにできない場合は fallback() の結果(既定のリンクカード)を返す
 */
export async function renderMisskeyNote(url: string, fallback: () => string): Promise<string> {
  const noteUrl = new URL(url);
  const host = noteUrl.host;
  const noteId = noteUrl.pathname.split('/')[2];

  const result = await fetchNote(host, noteId);
  if (result.status === 'unavailable') return unavailablePlaceholder(noteUrl.toString());
  if (result.status === 'unknown') return fallback();

  const { note } = result;
  if (note.visibility !== 'public' && note.visibility !== 'home') return unavailablePlaceholder(noteUrl.toString());

  const images = note.files.filter((file) => file.type.startsWith('image/'));
  // リノートのみのノートは見せるものが無い
  if (!note.text && !note.cw && note.files.length === 0 && note.renoteId) return fallback();

  const hasCw = note.cw !== null;
  const displayName = note.user.name || note.user.username;
  const visibleText = hasCw ? note.cw : note.text;

  // 絵文字のURLは note.emojis / user.emojis を優先し、無い名前だけ api/emoji で取得する
  const known = new Map<string, string>();
  for (const [name, emojiUrl] of Object.entries({ ...note.emojis, ...note.user.emojis })) {
    const safe = safeUrl(emojiUrl);
    if (safe) known.set(name, safe);
  }
  const unknownNames = collectEmojiNames(visibleText, displayName).filter((name) => !known.has(name));
  const [iconUrl, fetchedEmojis] = await Promise.all([
    fetchServerIcon(host),
    Promise.all(unknownNames.map(async (name) => [name, safeUrl(await fetchEmojiUrl(host, name))] as const)),
  ]);
  const emojiUrls = new Map(known);
  for (const [name, emojiUrl] of fetchedEmojis) {
    if (emojiUrl) emojiUrls.set(name, emojiUrl);
  }

  const noteHref = noteUrl.toString();
  const acct = note.user.host ? `${note.user.username}@${note.user.host}` : note.user.username;
  const profileUrl = `https://${host}/@${acct}`;
  const avatar = safeUrl(note.user.avatarUrl);
  const serverIcon = safeUrl(iconUrl);

  const header = [
    '<div class="misskey-header">',
    avatar
      ? externalLink(
          profileUrl,
          'class="misskey-avatar" ',
          `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(displayName)}">`,
        )
      : '',
    '<div class="misskey-author">',
    externalLink(profileUrl, 'class="misskey-name" ', renderText(displayName, emojiUrls)),
    `<span class="misskey-username">${escapeText(`@${note.user.username}@${note.user.host ?? host}`)}</span>`,
    '</div>',
    serverIcon
      ? externalLink(
          noteHref,
          'class="misskey-server" ',
          `<img src="${escapeHtml(serverIcon)}" alt="${escapeHtml(host)} で元のノートを開く">`,
        )
      : '',
    '</div>',
  ].filter(Boolean);

  const body: string[] = [];
  if (hasCw) {
    body.push(`<div class="misskey-text">${renderText(note.cw ?? '', emojiUrls)}</div>`);
    body.push(`<p class="misskey-more">${externalLink(noteHref, '', '続きを元のノートで読む')}</p>`);
  } else {
    if (note.text) body.push(`<div class="misskey-text">${renderText(note.text, emojiUrls)}</div>`);
    const shown = images.filter((file) => !file.isSensitive);
    const sensitiveCount = images.length - shown.length;
    const imagesHtml = renderImages(shown);
    if (imagesHtml) body.push(imagesHtml);
    if (sensitiveCount > 0) {
      body.push(
        `<p class="misskey-more">${externalLink(noteHref, '', `センシティブな画像 ${sensitiveCount} 件は元のノートで表示できます`)}</p>`,
      );
    }
  }

  const date = externalLink(
    noteHref,
    'class="misskey-date" ',
    `<time datetime="${escapeHtml(note.createdAt)}">${formatJst(note.createdAt)}</time>`,
  );

  return [
    '<div class="block-link block-link-misskey">',
    '<article class="misskey-card">',
    ...header,
    ...body,
    date,
    '</article>',
    '</div>',
  ].join('\n');
}

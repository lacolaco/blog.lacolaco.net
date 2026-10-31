import { strict as assert } from 'assert';
import { describe, test } from 'node:test';
import { createEmbedHandlers } from './handlers.ts';
import type { EmbedConfig } from './handlers.ts';

// テスト用のデフォルト設定
const defaultConfig: EmbedConfig = {
  youtube: {
    width: 560,
    height: 315,
    allowAttributes: [
      'accelerometer',
      'autoplay',
      'clipboard-write',
      'encrypted-media',
      'gyroscope',
      'picture-in-picture',
    ],
  },
  webpage: {
    timeout: 5000,
    fallbackTitle: 'Web Page',
  },
  tweet: {
    fallbackText: 'Tweet',
  },
  stackblitz: {
    width: '100%',
    height: 400,
  },
  googleSlides: {
    width: '100%',
    height: 480,
  },
};

describe('Embed Handlers', () => {
  const handlers = createEmbedHandlers(defaultConfig);

  describe('createTweetHandler', () => {
    const tweetHandler = handlers.find((h) => h.name === 'tweet')!;

    describe('test method', () => {
      test('Twitter投稿URLにマッチする', () => {
        assert.equal(tweetHandler.test('https://twitter.com/user/status/1234567890'), true);
        assert.equal(tweetHandler.test('https://www.twitter.com/user/status/1234567890'), true);
        assert.equal(tweetHandler.test('http://twitter.com/user/status/1234567890'), true);
        assert.equal(tweetHandler.test('http://www.twitter.com/user/status/1234567890'), true);
      });

      test('X.com投稿URLにマッチする', () => {
        assert.equal(tweetHandler.test('https://x.com/user/status/1234567890'), true);
        assert.equal(tweetHandler.test('https://www.x.com/user/status/1234567890'), true);
        assert.equal(tweetHandler.test('http://x.com/user/status/1234567890'), true);
        assert.equal(tweetHandler.test('http://www.x.com/user/status/1234567890'), true);
      });

      test('プロフィールURLにはマッチしない', () => {
        assert.equal(tweetHandler.test('https://twitter.com/user'), false);
        assert.equal(tweetHandler.test('https://x.com/user'), false);
        assert.equal(tweetHandler.test('https://twitter.com/user/'), false);
        assert.equal(tweetHandler.test('https://x.com/user/'), false);
      });

      test('非TwitterURLにはマッチしない', () => {
        assert.equal(tweetHandler.test('https://example.com'), false);
        assert.equal(tweetHandler.test('https://youtube.com/watch?v=123'), false);
        assert.equal(tweetHandler.test('https://github.com/user/repo'), false);
      });

      test('不正なstatusパスにはマッチしない', () => {
        assert.equal(tweetHandler.test('https://twitter.com/user/status/'), false);
        assert.equal(tweetHandler.test('https://x.com/user/status/'), false);
        assert.equal(tweetHandler.test('https://twitter.com/user/status/invalid'), false);
        assert.equal(tweetHandler.test('https://x.com/user/status/abc'), false);
      });
    });

    describe('transform method', () => {
      test('存在するツイートは埋め込みHTMLを返す', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 200 }));
        try {
          const result = await tweetHandler.transform('https://x.com/user/status/1234567890');
          assert.ok(result);
          assert.ok(result.includes('twitter-tweet'));
          assert.ok(result.includes('block-link-tweet'));
          assert.ok(!result.includes('block-link-tweet-unavailable'));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('404のツイートはプレースホルダHTMLを返す', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.resolve(new Response('Not Found', { status: 404 }));
        try {
          const result = await tweetHandler.transform('https://x.com/user/status/9999999999999');
          assert.ok(result);
          assert.ok(result.includes('block-link-tweet-unavailable'));
          assert.ok(result.includes('https://twitter.com/user/status/9999999999999'));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('403のツイートはプレースホルダHTMLを返す', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.resolve(new Response('Forbidden', { status: 403 }));
        try {
          const result = await tweetHandler.transform('https://x.com/user/status/9999999999999');
          assert.ok(result);
          assert.ok(result.includes('block-link-tweet-unavailable'));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('fetchがエラーの場合は通常の埋め込みHTMLを返す', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.reject(new Error('Network error'));
        try {
          const result = await tweetHandler.transform('https://x.com/user/status/1234567890');
          assert.ok(result);
          assert.ok(result.includes('twitter-tweet'));
          assert.ok(!result.includes('block-link-tweet-unavailable'));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('429(レート制限)の場合は通常の埋め込みHTMLを返す', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.resolve(new Response('Rate Limited', { status: 429 }));
        try {
          const result = await tweetHandler.transform('https://x.com/user/status/1234567890');
          assert.ok(result);
          assert.ok(result.includes('twitter-tweet'));
          assert.ok(!result.includes('block-link-tweet-unavailable'));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('x.comのURLはtwitter.comに変換される', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.resolve(new Response('{}', { status: 200 }));
        try {
          const result = await tweetHandler.transform('https://x.com/user/status/1234567890');
          assert.ok(result);
          assert.ok(result.includes('https://twitter.com/user/status/1234567890'));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });
    });
  });

  describe('createMisskeyHandler', () => {
    const misskeyHandler = handlers.find((h) => h.name === 'misskey')!;
    const noteUrl = 'https://misskey.io/notes/aszh5x0wbw860cta';
    const defaultCardPrefix = '<div class="block-link block-link-default">';

    type Json = Record<string, unknown>;
    const json = (body: unknown, status = 200) =>
      new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

    // APIのパスごとに応答を差し替える。呼び出し履歴も返す
    async function withFetch<T>(
      routes: Partial<Record<string, (body: Json) => Response | Promise<Response>>>,
      run: (calls: { path: string; body: Json }[]) => Promise<T> | T,
    ): Promise<T> {
      const originalFetch = globalThis.fetch;
      const calls: { path: string; body: Json }[] = [];
      globalThis.fetch = async (input, init) => {
        const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        const body = (typeof init?.body === 'string' ? JSON.parse(init.body) : {}) as Json;
        calls.push({ path: url.pathname, body });
        const route = routes[url.pathname];
        if (!route) return new Response('Not Found', { status: 404 });
        return route(body);
      };
      try {
        return await run(calls);
      } finally {
        globalThis.fetch = originalFetch;
      }
    }

    const baseNote = {
      id: 'aszh5x0wbw860cta',
      createdAt: '2026-10-31T04:38:12.080Z',
      text: 'こんにちは',
      cw: null,
      visibility: 'public',
      renoteId: null,
      user: {
        name: 'らこらこ',
        username: 'lacolaco',
        host: null,
        avatarUrl: 'https://img.example/avatar.png',
        emojis: {},
      },
      files: [],
    };
    const meta = () => json({ iconUrl: 'https://img.example/server.png', name: 'Misskey.io' });
    const noteRoutes = (note: Json, extra: Record<string, (body: Json) => Response | Promise<Response>> = {}) => ({
      '/api/notes/show': () => json(note),
      '/api/meta': meta,
      ...extra,
    });
    const image = (over: Json = {}) => ({
      type: 'image/jpeg',
      isSensitive: false,
      thumbnailUrl: 'https://img.example/t1.webp',
      url: 'https://img.example/o1.webp',
      properties: { width: 3000, height: 4000 },
      comment: null,
      ...over,
    });

    describe('test method', () => {
      test('/notes/<id> のhttps URLにホストを問わずマッチする', () => {
        assert.equal(misskeyHandler.test(noteUrl), true);
        assert.equal(misskeyHandler.test('https://misskey.example.com/notes/abc123'), true);
      });

      test('ノート以外のURLにはマッチしない', () => {
        assert.equal(misskeyHandler.test('https://misskey.io/@lacolaco'), false);
        assert.equal(misskeyHandler.test('https://misskey.io/notes/'), false);
        assert.equal(misskeyHandler.test('https://misskey.io/notes/abc/def'), false);
        assert.equal(misskeyHandler.test('https://misskey.io/notes/abc-def'), false);
        assert.equal(misskeyHandler.test('http://misskey.io/notes/abc123'), false);
        assert.equal(misskeyHandler.test('not-a-url'), false);
      });
    });

    describe('transform method', () => {
      test('公開ノートはカードになり、基本要素を含む', async () => {
        const html = await withFetch(noteRoutes(baseNote), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.ok(html.startsWith('<div class="block-link block-link-misskey">'));
        assert.ok(html.includes('src="https://img.example/avatar.png"'));
        assert.ok(html.includes('alt="らこらこ"'));
        // Misskey 本家の MkAcct と同じく、ユーザー名とホストを別の要素にする
        assert.ok(
          html.includes('<span class="misskey-username"><span>@lacolaco</span><span>@misskey.io</span></span>'),
        );
        assert.ok(!html.includes('@lacolaco@misskey.io'));
        assert.ok(html.includes('こんにちは'));
        assert.ok(html.includes('href="https://misskey.io/@lacolaco"'));
        assert.ok(html.includes('src="https://img.example/server.png"'));
        assert.ok(html.includes('target="_blank" rel="noopener noreferrer"'));
      });

      test('右上のサーバーアイコンは元のノートへリンクする', async () => {
        const html = await withFetch(noteRoutes(baseNote), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.match(
          html,
          /<a class="misskey-server" href="https:\/\/misskey\.io\/notes\/aszh5x0wbw860cta" target="_blank" rel="noopener noreferrer"><img src="https:\/\/img\.example\/server\.png" alt="misskey\.io で元のノートを開く"><\/a>/,
        );
        assert.ok(!html.includes('href="https://misskey.io/"'));
      });

      test('リモートユーザーは user.host を使う', async () => {
        const note = { ...baseNote, user: { ...baseNote.user, host: 'remote.example' } };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(
          html?.includes('<span class="misskey-username"><span>@lacolaco</span><span>@remote.example</span></span>'),
        );
        assert.ok(html?.includes('href="https://misskey.io/@lacolaco@remote.example"'));
        assert.ok(!html?.includes('href="https://misskey.io/@lacolaco"'));
      });

      test('投稿日時はJSTの絶対時刻で、元ノートへのリンクになる', async () => {
        const html = await withFetch(noteRoutes(baseNote), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.match(
          html,
          /<a [^>]*href="https:\/\/misskey\.io\/notes\/aszh5x0wbw860cta"[^>]*><time datetime="2026-10-31T04:38:12.080Z">2026\/10\/31 13:38<\/time><\/a>/,
        );
      });

      test('home のノートもカードになる', async () => {
        const html = await withFetch(noteRoutes({ ...baseNote, visibility: 'home' }), () =>
          misskeyHandler.transform(noteUrl),
        );
        assert.ok(html?.startsWith('<div class="block-link block-link-misskey">'));
      });

      test('本文はHTMLエスケープされ、MFMは解釈されない', async () => {
        const note = { ...baseNote, text: '<script>alert(1)</script> **bold** & "q"' };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.ok(!html.includes('<script>'));
        assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; **bold** &amp; &quot;q&quot;'));
        assert.ok(!html.includes('<strong>'));
      });

      test('画像はthumbnailUrlと元の比率のwidth/heightとlazyで出力され、拡大表示用に元画像のURLを持つ', async () => {
        const note = {
          ...baseNote,
          files: [image({ comment: '説明' }), image({ thumbnailUrl: 'https://img.example/t2.webp' })],
        };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.match(
          html,
          /<img src="https:\/\/img\.example\/t1\.webp" alt="説明" width="3000" height="4000" loading="lazy" data-lightbox-src="https:\/\/img\.example\/o1\.webp">/,
        );
        assert.match(
          html,
          /<img src="https:\/\/img\.example\/t2\.webp" alt="" width="3000" height="4000" loading="lazy" data-lightbox-src="https:\/\/img\.example\/o1\.webp">/,
        );
      });

      test('センシティブな画像は出さず件数と元ノートへのリンクを出す', async () => {
        const note = {
          ...baseNote,
          files: [
            image(),
            image({ isSensitive: true, thumbnailUrl: 'https://img.example/secret.webp' }),
            image({ isSensitive: true }),
          ],
        };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.ok(!html.includes('secret.webp'));
        assert.ok(html.includes('センシティブな画像 2 件は元のノートで表示できます'));
        assert.ok(html.includes('https://img.example/t1.webp'));
      });

      test('cw付きノートは本文と画像を出さずCWの文と続きへのリンクを出す', async () => {
        const note = { ...baseNote, cw: 'ネタバレ注意', text: '秘密の本文', files: [image()] };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.ok(html.includes('ネタバレ注意'));
        assert.ok(html.includes('続きを元のノートで読む'));
        assert.ok(!html.includes('秘密の本文'));
        assert.ok(!html.includes('t1.webp'));
      });

      test('カスタム絵文字は note.emojis のURLで画像になる', async () => {
        const note = {
          ...baseNote,
          text: 'やった :anagi_good: ok',
          emojis: { anagi_good: 'https://img.example/e.png' },
        };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html?.includes('<img class="misskey-emoji" alt=":anagi_good:" src="https://img.example/e.png">'));
      });

      test('表示名中の絵文字は user.emojis で画像になる', async () => {
        const note = {
          ...baseNote,
          user: { ...baseNote.user, name: 'らこ :neko:', emojis: { neko: 'https://img.example/neko.png' } },
        };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html?.includes('alt=":neko:" src="https://img.example/neko.png"'));
      });

      test('emojis に無い絵文字は api/emoji で取得し、同名は1回だけ取得する', async () => {
        const note = { ...baseNote, text: ':foo: :foo: :bar:' };
        const { html, emojiCalls } = await withFetch(
          noteRoutes(note, {
            '/api/emoji': (body) =>
              body.name === 'foo' ? json({ url: 'https://img.example/foo.png' }) : new Response('{}', { status: 404 }),
          }),
          async (calls) => ({
            html: await misskeyHandler.transform(noteUrl),
            emojiCalls: calls.filter((c) => c.path === '/api/emoji').map((c) => c.body.name),
          }),
        );
        assert.ok(html);
        assert.equal(html.split('src="https://img.example/foo.png"').length - 1, 2);
        assert.deepEqual(emojiCalls.sort(), ['bar', 'foo']);
        // 取得できない絵文字は元のテキストのまま残る
        assert.ok(html.includes(':bar:'));
      });

      test('絵文字のURLに含まれる特殊文字はエスケープされる', async () => {
        const note = { ...baseNote, text: ':x:', emojis: { x: 'https://img.example/"><script>.png' } };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html);
        assert.ok(!html.includes('<script>'));
      });

      test('サーバーのアイコンが取得できなければ出さない', async () => {
        const html = await withFetch(
          noteRoutes(baseNote, { '/api/meta': () => new Response('error', { status: 500 }) }),
          () => misskeyHandler.transform(noteUrl),
        );
        assert.ok(html);
        assert.ok(html.startsWith('<div class="block-link block-link-misskey">'));
        assert.ok(!html.includes('server.png'));
      });

      const misskeyError = (status: number) =>
        json({ error: { message: 'No such note.', code: 'NO_SUCH_NOTE', kind: 'client' } }, status);

      for (const status of [400, 403, 404]) {
        test(`${status} でMisskeyのエラー応答の場合はプレースホルダを返す`, async () => {
          const html = await withFetch({ '/api/notes/show': () => misskeyError(status) }, () =>
            misskeyHandler.transform(noteUrl),
          );
          assert.ok(html);
          assert.ok(html.includes('block-link block-link-misskey block-link-misskey-unavailable'));
          assert.ok(html.includes('このノートは現在表示できません'));
          assert.ok(html.includes(`href="${noteUrl}"`));
        });
      }

      for (const status of [400, 403, 404, 422]) {
        test(`${status} でMisskeyのエラー応答ではない場合 (Misskey以外のサイト) は既定のリンクカードを返す`, async () => {
          const html = await withFetch({ '/api/notes/show': () => new Response('Not Found', { status }) }, () =>
            misskeyHandler.transform(noteUrl),
          );
          assert.ok(html);
          assert.ok(html.startsWith(defaultCardPrefix));
        });
      }

      test('応答しないホストはタイムアウトして既定のリンクカードを返す', async () => {
        const originalFetch = globalThis.fetch;
        // signal の abort だけで終わる fetch
        globalThis.fetch = (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          });
        try {
          const html = await misskeyHandler.transform(noteUrl);
          assert.ok(html);
          assert.ok(html.startsWith(defaultCardPrefix));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('followers など public/home 以外のノートはプレースホルダを返す', async () => {
        const html = await withFetch(noteRoutes({ ...baseNote, visibility: 'followers' }), () =>
          misskeyHandler.transform(noteUrl),
        );
        assert.ok(html?.includes('block-link-misskey-unavailable'));
      });

      for (const status of [429, 500, 503]) {
        test(`${status} の場合は既定のリンクカードを返す`, async () => {
          const html = await withFetch({ '/api/notes/show': () => new Response('', { status }) }, () =>
            misskeyHandler.transform(noteUrl),
          );
          assert.ok(html);
          assert.ok(html.startsWith(defaultCardPrefix));
          assert.ok(html.includes(`/embed?url=${noteUrl}`));
        });
      }

      test('ネットワークエラーの場合は既定のリンクカードを返す', async () => {
        const originalFetch = globalThis.fetch;
        globalThis.fetch = () => Promise.reject(new Error('Network error'));
        try {
          const html = await misskeyHandler.transform(noteUrl);
          assert.ok(html?.startsWith(defaultCardPrefix));
        } finally {
          globalThis.fetch = originalFetch;
        }
      });

      test('noteでないJSON(Misskey以外)の場合は既定のリンクカードを返す', async () => {
        const html = await withFetch({ '/api/notes/show': () => json({ hello: 'world' }) }, () =>
          misskeyHandler.transform(noteUrl),
        );
        assert.ok(html?.startsWith(defaultCardPrefix));
      });

      test('JSONでない応答の場合は既定のリンクカードを返す', async () => {
        const html = await withFetch({ '/api/notes/show': () => new Response('<html>', { status: 200 }) }, () =>
          misskeyHandler.transform(noteUrl),
        );
        assert.ok(html?.startsWith(defaultCardPrefix));
      });

      test('本文も画像も無いリノートのみのノートは既定のリンクカードを返す', async () => {
        const note = { ...baseNote, text: null, files: [], renoteId: 'other' };
        const html = await withFetch(noteRoutes(note), () => misskeyHandler.transform(noteUrl));
        assert.ok(html?.startsWith(defaultCardPrefix));
      });

      test('notes/show には noteId を POST する', async () => {
        const calls = await withFetch(noteRoutes(baseNote), async (c) => {
          await misskeyHandler.transform(noteUrl);
          return c;
        });
        const show = calls.find((c) => c.path === '/api/notes/show');
        assert.deepEqual(show?.body, { noteId: 'aszh5x0wbw860cta' });
      });
    });
  });

  describe('createYouTubeHandler', () => {
    const youtubeHandler = handlers.find((h) => h.name === 'youtube')!;

    describe('test method', () => {
      test('YouTubeのURLにマッチする', () => {
        assert.equal(youtubeHandler.test('https://youtube.com/watch?v=dQw4w9WgXcQ'), true);
        assert.equal(youtubeHandler.test('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
        assert.equal(youtubeHandler.test('http://youtube.com/watch?v=dQw4w9WgXcQ'), true);
        assert.equal(youtubeHandler.test('http://www.youtube.com/watch?v=dQw4w9WgXcQ'), true);
      });

      test('youtu.beのURLにマッチする', () => {
        assert.equal(youtubeHandler.test('https://youtu.be/dQw4w9WgXcQ'), true);
        assert.equal(youtubeHandler.test('http://youtu.be/dQw4w9WgXcQ'), true);
      });

      test('非YouTubeURLにはマッチしない', () => {
        assert.equal(youtubeHandler.test('https://example.com'), false);
        assert.equal(youtubeHandler.test('https://twitter.com/user/status/123'), false);
        assert.equal(youtubeHandler.test('https://vimeo.com/123456'), false);
        assert.equal(youtubeHandler.test('https://youtube.com.fake.com/watch?v=123'), false);
      });
    });
  });

  describe('createStackblitzHandler', () => {
    const stackblitzHandler = handlers.find((h) => h.name === 'stackblitz')!;

    describe('test method', () => {
      test('embed=1パラメータ付きのStackblitzURLにマッチする', () => {
        assert.equal(stackblitzHandler.test('https://stackblitz.com/edit/my-project?embed=1'), true);
        assert.equal(stackblitzHandler.test('https://stackblitz.com/@username/my-project?embed=1'), true);
        assert.equal(
          stackblitzHandler.test('https://stackblitz.com/~/github/angular/angular/tree/main/adev?embed=1'),
          true,
        );
        assert.equal(stackblitzHandler.test('https://stackblitz.com/edit/my-project?embed=1&view=preview'), true);
        assert.equal(stackblitzHandler.test('https://stackblitz.com/edit/my-project?view=preview&embed=1'), true);
      });

      test('embed=1パラメータがないStackblitzURLにはマッチしない', () => {
        assert.equal(stackblitzHandler.test('https://stackblitz.com/edit/my-project'), false);
        assert.equal(stackblitzHandler.test('https://stackblitz.com/@username/my-project'), false);
        assert.equal(stackblitzHandler.test('https://stackblitz.com/edit/my-project?embed=0'), false);
        assert.equal(stackblitzHandler.test('https://stackblitz.com/edit/my-project?view=preview'), false);
      });

      test('非StackblitzURLにはマッチしない', () => {
        assert.equal(stackblitzHandler.test('https://example.com'), false);
        assert.equal(stackblitzHandler.test('https://codesandbox.io/s/123?embed=1'), false);
        assert.equal(stackblitzHandler.test('https://stackblitz.com.fake.com/edit/my-project?embed=1'), false);
      });
    });
  });

  describe('createGoogleSlidesHandler', () => {
    const googleSlidesHandler = handlers.find((h) => h.name === 'googleSlides')!;

    describe('test method', () => {
      test('/pubで終わるGoogle SlidesのURLにマッチする', () => {
        assert.equal(
          googleSlidesHandler.test(
            'https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/pub',
          ),
          true,
        );
      });

      test('クエリパラメータ付きの/pubで終わるGoogle SlidesのURLにマッチする', () => {
        assert.equal(
          googleSlidesHandler.test(
            'https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/pub?start=false&loop=false&delayms=3000',
          ),
          true,
        );
      });

      test('/pubで終わらないGoogle SlidesのURLにはマッチしない', () => {
        assert.equal(
          googleSlidesHandler.test(
            'https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/edit',
          ),
          false,
        );
        assert.equal(
          googleSlidesHandler.test(
            'https://docs.google.com/presentation/d/e/2PACX-1vRI8Y64QSxw7obQQ_B6Zztyf6NvumARR2t6rWDLpipqcXfBeSssi63dsut3PUCQyUeLj6chqlO7ODOT/edit#slide=id.p',
          ),
          false,
        );
      });

      test('Google Slides以外のGoogle DocsのURLにはマッチしない', () => {
        assert.equal(googleSlidesHandler.test('https://docs.google.com/document/d/123/edit'), false);
        assert.equal(googleSlidesHandler.test('https://docs.google.com/spreadsheets/d/123/edit'), false);
        assert.equal(googleSlidesHandler.test('https://docs.google.com/forms/d/123/edit'), false);
      });

      test('非Google DocsのURLにはマッチしない', () => {
        assert.equal(googleSlidesHandler.test('https://example.com'), false);
        assert.equal(googleSlidesHandler.test('https://slides.com/user/deck'), false);
        assert.equal(googleSlidesHandler.test('https://docs.google.com.fake.com/presentation/d/123/pub'), false);
      });

      test('不正なURLにはマッチしない', () => {
        assert.equal(googleSlidesHandler.test('invalid-url'), false);
        assert.equal(googleSlidesHandler.test('https://docs.google.com/presentation/d/123/edit'), false); // /pubで終わらない
      });
    });
  });

  describe('createDefaultHandler', () => {
    const defaultHandler = handlers.find((h) => h.name === 'default')!;

    describe('test method', () => {
      test('httpsURLにマッチする', () => {
        assert.equal(defaultHandler.test('https://example.com'), true);
        assert.equal(defaultHandler.test('https://github.com/user/repo'), true);
        assert.equal(defaultHandler.test('https://blog.example.com/post/123'), true);
      });

      test('httpURLにマッチする', () => {
        assert.equal(defaultHandler.test('http://example.com'), true);
        assert.equal(defaultHandler.test('http://localhost:3000'), true);
        assert.equal(defaultHandler.test('http://192.168.1.1:8080'), true);
      });

      test('http/https以外のプロトコルにはマッチしない', () => {
        assert.equal(defaultHandler.test('ftp://example.com'), false);
        assert.equal(defaultHandler.test('file:///path/to/file'), false);
        assert.equal(defaultHandler.test('mailto:user@example.com'), false);
        assert.equal(defaultHandler.test('tel:+1234567890'), false);
      });

      test('プロトコルなしのURLにはマッチしない', () => {
        assert.equal(defaultHandler.test('example.com'), false);
        assert.equal(defaultHandler.test('www.example.com'), false);
        assert.equal(defaultHandler.test('//example.com'), false);
      });

      test('空文字や不正な文字列にはマッチしない', () => {
        assert.equal(defaultHandler.test(''), false);
        assert.equal(defaultHandler.test('not-a-url'), false);
        assert.equal(defaultHandler.test('just some text'), false);
      });
    });
  });

  describe('Handler Order', () => {
    test('ハンドラーが正しい順序で配置されている', () => {
      const handlerNames = handlers.map((h) => h.name);
      assert.deepEqual(handlerNames, ['tweet', 'misskey', 'youtube', 'stackblitz', 'googleSlides', 'default']);
    });

    test('defaultハンドラーが最後に配置されている', () => {
      const lastHandler = handlers[handlers.length - 1];
      assert.equal(lastHandler.name, 'default');
    });
  });

  describe('Handler Coverage', () => {
    test('全てのハンドラーが含まれている', () => {
      const expectedHandlers = ['tweet', 'misskey', 'youtube', 'stackblitz', 'googleSlides', 'default'];
      const actualHandlers = handlers.map((h) => h.name);
      assert.deepEqual(actualHandlers, expectedHandlers);
    });

    test('各ハンドラーに必要なメソッドが存在する', () => {
      handlers.forEach((handler) => {
        assert.equal(typeof handler.test, 'function', `${handler.name} handler should have test method`);
        assert.equal(typeof handler.transform, 'function', `${handler.name} handler should have transform method`);
        assert.equal(typeof handler.name, 'string', `${handler.name} handler should have name property`);
      });
    });
  });
});

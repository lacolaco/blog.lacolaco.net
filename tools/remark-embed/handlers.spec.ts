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
      assert.deepEqual(handlerNames, ['tweet', 'youtube', 'stackblitz', 'googleSlides', 'default']);
    });

    test('defaultハンドラーが最後に配置されている', () => {
      const lastHandler = handlers[handlers.length - 1];
      assert.equal(lastHandler.name, 'default');
    });
  });

  describe('Handler Coverage', () => {
    test('全てのハンドラーが含まれている', () => {
      const expectedHandlers = ['tweet', 'youtube', 'stackblitz', 'googleSlides', 'default'];
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

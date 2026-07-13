import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { angularJpReplacer, mdnJaReplacer, replaceUrls, type UrlReplacer } from './url-replacer.ts';

describe('angularJpReplacer', () => {
  test('angular.jp のホストを angular.dev に置換し、パスを維持する', () => {
    assert.equal(angularJpReplacer.replace('https://angular.jp/guide/signals'), 'https://angular.dev/guide/signals');
  });

  test('クエリ・フラグメントを維持する', () => {
    assert.equal(
      angularJpReplacer.replace('https://angular.jp/api/core/Signal?tab=api#usage'),
      'https://angular.dev/api/core/Signal?tab=api#usage',
    );
  });

  test('ルートURL（trailing slash なし）は正規化せずホストだけ置換する', () => {
    assert.equal(angularJpReplacer.replace('https://angular.jp'), 'https://angular.dev');
  });

  test('ルートURL（trailing slash あり）も置換する', () => {
    assert.equal(angularJpReplacer.replace('https://angular.jp/'), 'https://angular.dev/');
  });

  test('サブドメインや別ホストは置換しない', () => {
    assert.equal(angularJpReplacer.replace('https://v17.angular.io/guide/signals'), null);
    assert.equal(angularJpReplacer.replace('https://blog.angular.jp/post'), null);
    assert.equal(angularJpReplacer.replace('https://example.com/angular.jp'), null);
  });

  test('パスに angular.jp を含むだけのURLは置換しない', () => {
    assert.equal(angularJpReplacer.replace('https://example.com/docs/angular.jp/guide'), null);
  });

  test('パース不能な文字列は null', () => {
    assert.equal(angularJpReplacer.replace('not a url'), null);
  });
});

describe('mdnJaReplacer', () => {
  test('/ja/docs/ を /en-US/docs/ に置換する', () => {
    assert.equal(
      mdnJaReplacer.replace('https://developer.mozilla.org/ja/docs/Web/API/Window/fetch'),
      'https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch',
    );
  });

  test('フラグメント・クエリを維持する', () => {
    assert.equal(
      mdnJaReplacer.replace('https://developer.mozilla.org/ja/docs/Web/CSS/color#syntax'),
      'https://developer.mozilla.org/en-US/docs/Web/CSS/color#syntax',
    );
  });

  test('/en-US/ のURLは置換しない', () => {
    assert.equal(mdnJaReplacer.replace('https://developer.mozilla.org/en-US/docs/Web/CSS/color'), null);
  });

  test('他ロケール・ロケールなしURLは置換しない', () => {
    assert.equal(mdnJaReplacer.replace('https://developer.mozilla.org/fr/docs/Web/CSS/color'), null);
    assert.equal(mdnJaReplacer.replace('https://developer.mozilla.org/docs/Web/CSS/color'), null);
  });

  test('パスが /ja そのもの（/ja/ で始まらない）は置換しない', () => {
    // /javascript のような prefix 誤爆がないこと
    assert.equal(mdnJaReplacer.replace('https://developer.mozilla.org/javascript'), null);
  });

  test('MDN 以外のホストの /ja/ パスは置換しない', () => {
    assert.equal(mdnJaReplacer.replace('https://example.com/ja/docs/page'), null);
  });
});

describe('replaceUrls', () => {
  test('inline link の URL を置換する（リンクテキストは維持）', () => {
    const input = 'See [Signals guide](https://angular.jp/guide/signals) for details.\n';
    const expected = 'See [Signals guide](https://angular.dev/guide/signals) for details.\n';
    assert.equal(replaceUrls(input), expected);
  });

  test('bare autolink は href とテキストの両方が置換される', () => {
    const input = 'Reference:\n\nhttps://developer.mozilla.org/ja/docs/Web/API/Window/fetch\n';
    const expected = 'Reference:\n\nhttps://developer.mozilla.org/en-US/docs/Web/API/Window/fetch\n';
    assert.equal(replaceUrls(input), expected);
  });

  test('definition（参照リンク定義）の URL を置換する', () => {
    const input = 'See [guide][1].\n\n[1]: https://angular.jp/guide/signals\n';
    const expected = 'See [guide][1].\n\n[1]: https://angular.dev/guide/signals\n';
    assert.equal(replaceUrls(input), expected);
  });

  test('code block 内の URL は置換しない', () => {
    const input = '```ts\nconst url = "https://angular.jp/guide/signals";\n```\n';
    assert.equal(replaceUrls(input), input);
  });

  test('inline code 内の URL は置換しない', () => {
    const input = 'Use `https://angular.jp/api` as base.\n';
    assert.equal(replaceUrls(input), input);
  });

  test('blockquote 内のリンクは置換する', () => {
    const input = '> See [guide](https://angular.jp/guide/signals).\n';
    const expected = '> See [guide](https://angular.dev/guide/signals).\n';
    assert.equal(replaceUrls(input), expected);
  });

  test('複数の URL が混在しても全て置換される', () => {
    const input = [
      '[A](https://angular.jp/guide/signals) and [B](https://developer.mozilla.org/ja/docs/Web/CSS/color).',
      '',
      'https://angular.jp/api/core',
      '',
      '[C](https://example.com/keep) stays.',
      '',
    ].join('\n');
    const expected = [
      '[A](https://angular.dev/guide/signals) and [B](https://developer.mozilla.org/en-US/docs/Web/CSS/color).',
      '',
      'https://angular.dev/api/core',
      '',
      '[C](https://example.com/keep) stays.',
      '',
    ].join('\n');
    assert.equal(replaceUrls(input), expected);
  });

  test('対象 URL がなければ入力をそのまま返す', () => {
    const input = 'No links here.\n\n[X](https://example.com/page)\n';
    assert.equal(replaceUrls(input), input);
  });

  test('冪等性: 2 回適用しても結果が変わらない', () => {
    const input = '[A](https://angular.jp/guide) and https://developer.mozilla.org/ja/docs/Web/API\n';
    const once = replaceUrls(input);
    assert.equal(replaceUrls(once), once);
  });

  test('replacers を DI で差し替えられる', () => {
    const custom: UrlReplacer = {
      name: 'custom',
      replace: (url) => (url === 'https://old.example.com/x' ? 'https://new.example.com/x' : null),
    };
    const input = '[link](https://old.example.com/x) and [keep](https://angular.jp/guide)\n';
    const expected = '[link](https://new.example.com/x) and [keep](https://angular.jp/guide)\n';
    assert.equal(replaceUrls(input, [custom]), expected);
  });

  test('replacer が無変更の URL を返した場合は no-match 扱いで次の replacer に委ねる（契約違反の防御）', () => {
    const broken: UrlReplacer = { name: 'broken', replace: (url) => url };
    const fixer: UrlReplacer = {
      name: 'fixer',
      replace: (url) => (url.includes('target') ? 'https://fixed.example/' : null),
    };
    const result = replaceUrls('[x](https://target.example.com/)\n', [broken, fixer]);
    assert.match(result, /https:\/\/fixed\.example\//);
  });

  test('最初にマッチした replacer が優先される', () => {
    const first: UrlReplacer = {
      name: 'first',
      replace: (url) => (url.includes('target') ? 'https://a.example' : null),
    };
    const second: UrlReplacer = {
      name: 'second',
      replace: (url) => (url.includes('target') ? 'https://b.example' : null),
    };
    const result = replaceUrls('[x](https://target.example.com/)\n', [first, second]);
    assert.match(result, /https:\/\/a\.example/);
  });
});

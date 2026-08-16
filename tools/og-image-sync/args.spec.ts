import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { parseArgs } from './args.ts';

describe('parseArgs', () => {
  test('記事のパスを対象として受け取る', () => {
    assert.deepEqual(parseArgs(['content/notion/posts/a.md', 'content/notion/posts/b.md']), {
      renderAll: false,
      requested: ['content/notion/posts/a.md', 'content/notion/posts/b.md'],
    });
  });

  test('--all は全記事の指定になる', () => {
    assert.deepEqual(parseArgs(['--all']), { renderAll: true, requested: [] });
  });

  // 引数なしを全記事と解釈すると、空の差分を渡されたときに全件再生成が走る
  test('引数なしはエラーになる', () => {
    assert.throws(() => parseArgs([]), /--all/);
  });

  // 黙って無視すると、渡したのに描かれなかったことに気付けない
  test('--all と記事のパスの併用はエラーになる', () => {
    assert.throws(() => parseArgs(['--all', 'content/notion/posts/a.md']), /同時に/);
  });
});

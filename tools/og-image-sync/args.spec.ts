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

  // 記事の削除だけ、tags.json の更新だけ、という sync は正常にありうる。
  // 引数なしを全記事と解釈すると全件再生成が走るので、対象なしとして扱う
  test('引数なしは対象なしになる', () => {
    assert.deepEqual(parseArgs([]), { renderAll: false, requested: [] });
  });

  // 黙って無視すると、渡したのに描かれなかったことに気付けない
  test('--all と記事のパスの併用はエラーになる', () => {
    assert.throws(() => parseArgs(['--all', 'content/notion/posts/a.md']), /同時に/);
  });
});

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { createBatchedFontLoader } from './fonts.ts';

describe('createBatchedFontLoader', () => {
  // 記事数によらず取得は3回 (sans 400 / sans 700 / mono 400) に固定される
  test('記事数によらずフォントの取得は3回だけ', async () => {
    let calls = 0;
    const fetchFont = () => {
      calls += 1;
      return Promise.resolve(new ArrayBuffer(8));
    };

    const loader = await createBatchedFontLoader(['記事A', '記事B'], 'blog.example', fetchFont);
    await loader('記事A', 'Zen Kaku Gothic New', 700);
    await loader('記事B', 'Zen Kaku Gothic New', 700);

    assert.equal(calls, 3);
  });

  // 全タイトルの文字を1回の問い合わせにまとめる
  test('全タイトルの文字を含むテキストで取得する', async () => {
    let requested = '';
    const fetchFont = (text: string, _font: string, weight: number) => {
      if (weight === 700) requested = text;
      return Promise.resolve(new ArrayBuffer(8));
    };

    await createBatchedFontLoader(['設計', 'Angular'], 'blog.example', fetchFont);

    for (const ch of '設計Angular') {
      assert.ok(requested.includes(ch), `${ch} が要求に含まれていない`);
    }
  });

  test('未知のフォントを要求されたらエラーになる', async () => {
    const fetchFont = () => Promise.resolve(new ArrayBuffer(8));
    const loader = await createBatchedFontLoader(['記事'], 'blog.example', fetchFont);

    await assert.rejects(() => loader('x', 'Unknown Font', 400), /Unknown Font/);
  });
});

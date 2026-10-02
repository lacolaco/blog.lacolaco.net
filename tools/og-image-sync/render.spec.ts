import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { loadAvatarDataUrl } from './render.ts';

describe('loadAvatarDataUrl', () => {
  // 生成のたびに読み直すとavatarのbase64化が記事数だけ走るため、一度だけ読む
  test('PNGのdata URLを返す', () => {
    assert.match(loadAvatarDataUrl(), /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
  });

  test('同じ値を返す', () => {
    assert.equal(loadAvatarDataUrl(), loadAvatarDataUrl());
  });
});

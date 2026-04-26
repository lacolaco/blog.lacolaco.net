import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { extractAutoTranslate, frontmatterAutoTranslate } from './auto-translate-flag.ts';

describe('extractAutoTranslate', () => {
  test('true → true', () => {
    assert.equal(extractAutoTranslate(true), true);
  });

  test('false → false', () => {
    assert.equal(extractAutoTranslate(false), false);
  });

  test('undefined → false（プロパティ未存在のページ）', () => {
    assert.equal(extractAutoTranslate(undefined), false);
  });
});

describe('frontmatterAutoTranslate', () => {
  test('ja + true → true', () => {
    assert.equal(frontmatterAutoTranslate('ja', true), true);
  });

  test('ja + false → undefined（未指定時はキーを省略）', () => {
    assert.equal(frontmatterAutoTranslate('ja', false), undefined);
  });

  test('en + true → undefined（en は翻訳ソースになり得ないので無視）', () => {
    assert.equal(frontmatterAutoTranslate('en', true), undefined);
  });

  test('en + false → undefined', () => {
    assert.equal(frontmatterAutoTranslate('en', false), undefined);
  });

  test('未知の locale + true → undefined（ja 限定）', () => {
    assert.equal(frontmatterAutoTranslate('zh', true), undefined);
  });

  test('空文字 locale → undefined', () => {
    assert.equal(frontmatterAutoTranslate('', true), undefined);
  });
});

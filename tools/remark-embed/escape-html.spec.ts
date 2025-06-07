import { strict as assert } from 'assert';
import { test, describe } from 'node:test';
import { escapeHtml } from './escape-html.ts';

describe('escapeHtml', () => {
  test('特殊文字をHTMLエンティティにエスケープする', () => {
    const input = '<script>alert("XSS");</script>';
    const expected = '&lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt;';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('アンパサンドをエスケープする', () => {
    const input = 'A & B';
    const expected = 'A &amp; B';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('URLのクエリパラメータ内のアンパサンドをエスケープする', () => {
    const input = 'https://example.com?param1=value1&param2=value2';
    const expected = 'https://example.com?param1=value1&amp;param2=value2';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('シングルクォートをエスケープする', () => {
    const input = "It's a test";
    const expected = 'It&#39;s a test';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('ダブルクォートをエスケープする', () => {
    const input = 'Say "Hello"';
    const expected = 'Say &quot;Hello&quot;';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('小なり記号をエスケープする', () => {
    const input = 'x < y';
    const expected = 'x &lt; y';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('大なり記号をエスケープする', () => {
    const input = 'x > y';
    const expected = 'x &gt; y';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('すべての特殊文字が含まれる文字列をエスケープする', () => {
    const input = `&<>"'`;
    const expected = '&amp;&lt;&gt;&quot;&#39;';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('特殊文字が含まれない文字列はそのまま返す', () => {
    const input = 'Hello World 123';
    const expected = 'Hello World 123';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('空文字列を処理する', () => {
    const input = '';
    const expected = '';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });

  test('複数の同じ特殊文字をエスケープする', () => {
    const input = '&&&';
    const expected = '&amp;&amp;&amp;';
    const result = escapeHtml(input);
    assert.equal(result, expected);
  });
});

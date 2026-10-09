import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { searchLogLine } from './log.ts';

describe('searchLogLine', () => {
  it('検索イベントの 1 行 JSON に、従来の欄と検索の識別子 id を含める', () => {
    const line = searchLogLine({ q: 'angular', locale: 'ja', hits: 3, ms: 12 }, () => 'fixed-id');
    assert.deepEqual(JSON.parse(line), {
      event: 'search',
      id: 'fixed-id',
      q: 'angular',
      locale: 'ja',
      hits: 3,
      ms: 12,
    });
  });

  it('呼び出しごとに別の id になる (同じ検索語でも区別できる)', () => {
    const a = JSON.parse(searchLogLine({ q: 'same', locale: 'en', hits: 0, ms: 1 })) as { id: string };
    const b = JSON.parse(searchLogLine({ q: 'same', locale: 'en', hits: 0, ms: 1 })) as { id: string };
    assert.notEqual(a.id, b.id);
  });

  it('id は検索語や locale から作らない乱数の UUID で、検索語を含まない', () => {
    const q = 'secret-term-0123456789';
    const { id } = JSON.parse(searchLogLine({ q, locale: 'ja', hits: 0, ms: 1 })) as { id: string };
    assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.ok(!id.includes(q));
  });
});

import assert from 'assert';
import { describe, it } from 'node:test';
import { formatJSON, toTagsJSON, toCategoriesJSON } from './utils';
import type { BlogDatabaseProperties } from '@lib/notion';

describe('formatJSON', () => {
  it('オブジェクトを整形されたJSONに変換する', async () => {
    const data = { foo: 'bar', number: 42, nested: { key: 'value' } };
    const result = await formatJSON(data);
    const expected = `{
  "foo": "bar",
  "number": 42,
  "nested": {
    "key": "value"
  }
}
`;
    assert.strictEqual(result, expected);
  });

  it('配列を整形されたJSONに変換する', async () => {
    const data = ['item1', 'item2', { key: 'value' }];
    const result = await formatJSON(data);
    const expected = `[
  "item1",
  "item2",
  {
    "key": "value"
  }
]
`;
    assert.strictEqual(result, expected);
  });

  it('nullを整形されたJSONに変換する', async () => {
    const data = null;
    const result = await formatJSON(data);
    assert.strictEqual(result, 'null\n');
  });

  it('数値を整形されたJSONに変換する', async () => {
    const data = 123;
    const result = await formatJSON(data);
    assert.strictEqual(result, '123\n');
  });
});

describe('toTagsJSON', () => {
  it('NotionのタグプロパティをTagsオブジェクトに変換する', () => {
    const config: BlogDatabaseProperties['tags'] = {
      id: 'test-id',
      name: 'Tags',
      type: 'multi_select',
      description: 'Tags property',
      multi_select: {
        options: [
          { id: 'tag1-id', name: 'JavaScript', color: 'blue', description: 'JavaScript tag' },
          { id: 'tag2-id', name: 'TypeScript', color: 'red', description: 'TypeScript tag' },
          { id: 'tag3-id', name: 'Angular', color: 'green', description: 'Angular tag' },
        ],
      },
    };

    const result = toTagsJSON(config);

    assert.deepStrictEqual(result, {
      JavaScript: { name: 'JavaScript', color: 'blue' },
      TypeScript: { name: 'TypeScript', color: 'red' },
      Angular: { name: 'Angular', color: 'green' },
    });
  });

  it('空のオプション配列でも動作する', () => {
    const config: BlogDatabaseProperties['tags'] = {
      id: 'test-id',
      name: 'Tags',
      type: 'multi_select',
      description: 'Tags property',
      multi_select: {
        options: [],
      },
    };

    const result = toTagsJSON(config);

    assert.deepStrictEqual(result, {});
  });

  it('単一のタグでも動作する', () => {
    const config: BlogDatabaseProperties['tags'] = {
      id: 'test-id',
      name: 'Tags',
      type: 'multi_select',
      description: 'Tags property',
      multi_select: {
        options: [{ id: 'tag1-id', name: 'React', color: 'purple', description: 'React tag' }],
      },
    };

    const result = toTagsJSON(config);

    assert.deepStrictEqual(result, {
      React: { name: 'React', color: 'purple' },
    });
  });
});

describe('toCategoriesJSON', () => {
  it('NotionのカテゴリプロパティをCategoriesオブジェクトに変換する', () => {
    const config: BlogDatabaseProperties['category'] = {
      id: 'test-id',
      name: 'Category',
      type: 'select',
      description: 'Category property',
      select: {
        options: [
          { id: 'cat1-id', name: 'Tech', color: 'blue', description: 'Tech category' },
          { id: 'cat2-id', name: 'Life', color: 'green', description: 'Life category' },
          { id: 'cat3-id', name: 'Review', color: 'yellow', description: 'Review category' },
        ],
      },
    };

    const result = toCategoriesJSON(config);

    assert.deepStrictEqual(result, {
      Tech: { name: 'Tech', color: 'blue' },
      Life: { name: 'Life', color: 'green' },
      Review: { name: 'Review', color: 'yellow' },
    });
  });

  it('空のオプション配列でも動作する', () => {
    const config: BlogDatabaseProperties['category'] = {
      id: 'test-id',
      name: 'Category',
      type: 'select',
      description: 'Category property',
      select: {
        options: [],
      },
    };

    const result = toCategoriesJSON(config);

    assert.deepStrictEqual(result, {});
  });

  it('単一のカテゴリでも動作する', () => {
    const config: BlogDatabaseProperties['category'] = {
      id: 'test-id',
      name: 'Category',
      type: 'select',
      description: 'Category property',
      select: {
        options: [{ id: 'cat1-id', name: 'Programming', color: 'red', description: 'Programming category' }],
      },
    };

    const result = toCategoriesJSON(config);

    assert.deepStrictEqual(result, {
      Programming: { name: 'Programming', color: 'red' },
    });
  });
});

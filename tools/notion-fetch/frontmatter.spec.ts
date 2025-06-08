import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatFrontmatter, parseFrontmatter } from './frontmatter';
import type { BlogPostFrontmatter } from './blog-types';

describe('frontmatter', () => {
  describe('formatFrontmatter', () => {
    it('should format simple frontmatter object to YAML string', () => {
      const frontmatter: BlogPostFrontmatter = {
        title: 'Test Post',
        slug: 'test-post',
        icon: '📝',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        category: 'tech',
        tags: ['typescript', 'testing'],
        published: true,
        notion_url: 'https://notion.so/test',
      };

      const result = formatFrontmatter(frontmatter);

      const expected = `title: 'Test Post'
slug: 'test-post'
icon: '📝'
created_time: '2023-01-01T00:00:00.000Z'
last_edited_time: '2023-01-02T00:00:00.000Z'
category: 'tech'
tags:
  - 'typescript'
  - 'testing'
published: true
notion_url: 'https://notion.so/test'`;

      assert.strictEqual(result, expected);
    });

    it('should handle empty arrays in frontmatter', () => {
      const frontmatter: BlogPostFrontmatter = {
        title: 'Empty Tags Post',
        slug: 'empty-tags',
        icon: '',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        category: '',
        tags: [],
        published: false,
        notion_url: 'https://notion.so/test',
      };

      const result = formatFrontmatter(frontmatter);

      const expected = `title: 'Empty Tags Post'
slug: 'empty-tags'
icon: ''
created_time: '2023-01-01T00:00:00.000Z'
last_edited_time: '2023-01-02T00:00:00.000Z'
category: ''
tags: []
published: false
notion_url: 'https://notion.so/test'`;

      assert.strictEqual(result, expected);
    });

    it('should handle special characters in strings', () => {
      const frontmatter: BlogPostFrontmatter = {
        title: 'Post with \'quotes\' and "double quotes"',
        slug: 'special-chars',
        icon: '🔥',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        category: 'category with spaces',
        tags: ['tag-with-dashes', 'tag with spaces'],
        published: true,
        notion_url: 'https://notion.so/test?param=value',
      };

      const result = formatFrontmatter(frontmatter);

      const expected = `title: 'Post with ''quotes'' and "double quotes"'
slug: 'special-chars'
icon: '🔥'
created_time: '2023-01-01T00:00:00.000Z'
last_edited_time: '2023-01-02T00:00:00.000Z'
category: 'category with spaces'
tags:
  - 'tag-with-dashes'
  - 'tag with spaces'
published: true
notion_url: 'https://notion.so/test?param=value'`;

      assert.strictEqual(result, expected);
    });

    it('should handle optional locale field', () => {
      const frontmatter: BlogPostFrontmatter = {
        title: 'Localized Post',
        slug: 'localized-post.en',
        icon: '🌍',
        created_time: '2023-01-01T00:00:00.000Z',
        last_edited_time: '2023-01-02T00:00:00.000Z',
        category: 'international',
        tags: ['i18n'],
        published: true,
        notion_url: 'https://notion.so/test',
        locale: 'en',
      };

      const result = formatFrontmatter(frontmatter);

      const expected = `title: 'Localized Post'
slug: 'localized-post.en'
icon: '🌍'
created_time: '2023-01-01T00:00:00.000Z'
last_edited_time: '2023-01-02T00:00:00.000Z'
category: 'international'
tags:
  - 'i18n'
published: true
notion_url: 'https://notion.so/test'
locale: 'en'`;

      assert.strictEqual(result, expected);
    });
  });

  describe('parseFrontmatter', () => {
    it('should parse valid YAML frontmatter from markdown', () => {
      const markdown = `---
title: 'Test Post'
slug: 'test-post'
published: true
tags:
  - typescript
  - testing
---

# Content

This is the post content.`;

      const result = parseFrontmatter(markdown);

      assert.ok(result !== null);
      assert.strictEqual(result.title, 'Test Post');
      assert.strictEqual(result.slug, 'test-post');
      assert.strictEqual(result.published, true);
      assert.ok(Array.isArray(result.tags));
      assert.strictEqual((result.tags as string[])[0], 'typescript');
      assert.strictEqual((result.tags as string[])[1], 'testing');
    });

    it('should return null for markdown without frontmatter', () => {
      const markdown = `# Test Post

This is just regular markdown content.`;

      const result = parseFrontmatter(markdown);

      assert.strictEqual(result, null);
    });

    it('should return empty object for empty frontmatter', () => {
      const markdown = `---
---

# Content`;

      const result = parseFrontmatter(markdown);

      assert.deepStrictEqual(result, {});
    });

    it('should return empty object for whitespace-only frontmatter', () => {
      const markdown = `---
   
   
---

# Content`;

      const result = parseFrontmatter(markdown);

      assert.deepStrictEqual(result, {});
    });

    it('should return null for invalid YAML frontmatter', () => {
      const markdown = `---
title: Test Post
invalid: [unclosed array
tags:
  - typescript
---

# Content`;

      const result = parseFrontmatter(markdown);

      assert.strictEqual(result, null);
    });

    it('should return null for non-object YAML frontmatter', () => {
      const markdown = `---
- this is an array
- not an object
---

# Content`;

      const result = parseFrontmatter(markdown);

      assert.strictEqual(result, null);
    });

    it('should handle complex nested structures', () => {
      const markdown = `---
title: 'Complex Post'
metadata:
  author: 'Test Author'
  version: 1.0
tags:
  - complex
  - nested
published: true
---

# Content`;

      const result = parseFrontmatter(markdown);

      assert.ok(result !== null);
      assert.strictEqual(result.title, 'Complex Post');
      assert.ok(typeof result.metadata === 'object');
      const metadata = result.metadata as Record<string, unknown>;
      assert.strictEqual(metadata.author, 'Test Author');
      assert.strictEqual(metadata.version, 1.0);
    });

    it('should handle frontmatter with missing trailing newline', () => {
      const markdown = `---
title: 'No Trailing Newline'
published: true
---# Immediate Content`;

      const result = parseFrontmatter(markdown);

      assert.ok(result !== null);
      assert.strictEqual(result.title, 'No Trailing Newline');
      assert.strictEqual(result.published, true);
    });

    it('should handle frontmatter with trailing whitespace', () => {
      const markdown = `---
title: 'Extra Whitespace'  
published: true  
---

# Content`;

      const result = parseFrontmatter(markdown);

      assert.ok(result !== null);
      assert.strictEqual(result.title, 'Extra Whitespace');
      assert.strictEqual(result.published, true);
    });
  });
});

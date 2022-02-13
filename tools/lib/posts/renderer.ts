import { isAfter as isAfterDate } from 'date-fns';
import { format } from 'prettier';
import { parseFrontmatter, renderContentMarkdown, renderFrontmatter } from './markdown';
import { ImagesRepository, LocalPostsRepository } from './repository';
import { NotionPost } from './types';
import { createPagePropertyMap } from './utils';

export class LocalPostRenderer {
  constructor(
    private readonly localPostsRepositiry: LocalPostsRepository,
    private readonly imagesRepository: ImagesRepository,
  ) {}

  async renderPosts(posts: NotionPost[], options: { forceUpdate?: boolean } = {}) {
    await Promise.all(posts.map((page) => this.renderPost(page, options)));
  }

  async renderPost(page: NotionPost, options: { forceUpdate?: boolean } = {}) {
    const { created_time: remoteCreatedAt, last_edited_time: remoteUpdatedAt, archived } = page;
    if (archived) {
      return;
    }
    const pageProps = createPagePropertyMap(page);
    const title = pageProps.get('title', 'title')?.title[0]?.plain_text;
    const slug = pageProps.get('Y~YJ', 'rich_text')?.rich_text[0]?.plain_text ?? null;
    const tags = pageProps.get('v%5EIo', 'multi_select')?.multi_select.map((node) => node.name) ?? [];
    const publishable = pageProps.get('vssQ', 'checkbox')?.checkbox ?? false;
    if (title == null || slug == null) {
      console.warn(`title or slug is null: ${JSON.stringify(page, null, 2)}`);
      return;
    }
    // skip if local post is already up to date
    const localContent = await this.localPostsRepositiry.loadPost(slug);
    if (localContent != null) {
      const localFrontmatter = parseFrontmatter(localContent);
      const localUpdatedAt = (localFrontmatter['updated_at'] as string) ?? (localFrontmatter['date'] as string);
      if (!isAfterDate(new Date(remoteUpdatedAt), new Date(localUpdatedAt)) && !options.forceUpdate) {
        console.log(`skip ${slug} (local is up to date)`);
        return;
      }
      console.log(`update ${slug} (local is outdated)`);
    } else {
      console.log(`create ${slug}`);
    }

    const frontmatter = renderFrontmatter({
      title,
      date: remoteCreatedAt,
      updated_at: remoteUpdatedAt,
      tags,
      draft: !publishable,
    });
    const body = await renderContentMarkdown(page.content, (url) => this.imagesRepository.download(slug, url));
    const content = format([frontmatter, body].join('\n\n'), {
      parser: 'markdown',
      ...require('../../../.prettierrc.json'),
    });

    await this.localPostsRepositiry.savePost(slug, content);
  }
}

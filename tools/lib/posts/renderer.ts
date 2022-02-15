import { isAfter as isAfterDate } from 'date-fns';
import { format } from 'prettier';
import { parseFrontmatter, renderFrontmatter } from './frontmatter';
import { PostContentRenderer } from './markdown';
import { ImagesRepository, LocalPostsRepository } from './repository';
import { NotionPost } from './types';
import { createPagePropertyMap } from './utils';

export class LocalPostRenderer {
  private readonly postContentRenderer = new PostContentRenderer(this.imagesRepository);

  constructor(
    private readonly localPostsRepositiry: LocalPostsRepository,
    private readonly imagesRepository: ImagesRepository,
    private readonly options: { forceUpdate?: boolean },
  ) {}

  async renderPosts(posts: NotionPost[]) {
    await Promise.all(posts.map((page) => this.renderPost(page)));
  }

  private async renderPost(post: NotionPost) {
    const { created_time: remoteCreatedAt, last_edited_time: remoteUpdatedAt, archived } = post;
    if (archived) {
      return;
    }
    const props = createPagePropertyMap(post);
    const title = props.get('title', 'title')?.title[0]?.plain_text;
    const slug = props.get('Y~YJ', 'rich_text')?.rich_text[0]?.plain_text ?? null;
    const tags = props.get('v%5EIo', 'multi_select')?.multi_select.map((node) => node.name) ?? [];
    const publishable = props.get('vssQ', 'checkbox')?.checkbox ?? false;
    if (title == null || slug == null) {
      console.warn(`title or slug is null: ${JSON.stringify(post, null, 2)}`);
      return;
    }
    // skip if local post is already up to date
    const localContent = await this.localPostsRepositiry.loadPost(slug);
    if (localContent != null) {
      const localFrontmatter = parseFrontmatter(localContent);
      const localUpdatedAt = (localFrontmatter['updated_at'] as string) ?? (localFrontmatter['date'] as string);
      if (
        localUpdatedAt &&
        !isAfterDate(new Date(remoteUpdatedAt), new Date(localUpdatedAt)) &&
        !this.options.forceUpdate
      ) {
        console.log(`skip ${slug} (local is up to date)`);
        return;
      }
      console.log(`update ${slug} (local is outdated)`);
    } else {
      console.log(`create ${slug}`);
    }

    await this.imagesRepository.clearPostImages(slug);
    const frontmatter = renderFrontmatter({
      title,
      date: remoteCreatedAt,
      updated_at: remoteUpdatedAt,
      tags,
      draft: !publishable,
      source: post.url,
    });

    const body = await this.postContentRenderer.render(slug, post.content);
    const content = format([frontmatter, body].join('\n\n'), {
      parser: 'markdown',
      ...require('../../../.prettierrc.json'),
    });

    await this.localPostsRepositiry.savePost(slug, content);
  }
}

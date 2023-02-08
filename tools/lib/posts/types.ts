import { ObservableInput } from 'rxjs';
import { BlockObject, PageObject } from '../notion';

export type NotionPostPage = PageObject & { content: BlockObject[] };

export type TaskFactory<T = any> = () => ObservableInput<T>;

export interface RendererContext {
  readonly slug: string;
  readonly fetchExternalImage: (req: { url: string; localPath: string }) => void;
}

export type PostAttributes = {
  readonly title: string;
  readonly date: string;
  readonly updated_at?: string;
  readonly tags: string[];
  readonly summary?: string;
  readonly draft: boolean;
  readonly emoji?: string;
  readonly source: string;
};

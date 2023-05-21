import type { RendererFeature } from './features';

export type RenderResult = {
  filename: string;
  content: string;
};

export type RenderContext = {
  readonly imagesBasePath: string;
  readonly imageRequests: { url: string; filename: string }[];
  readonly features: Set<RendererFeature>;
};

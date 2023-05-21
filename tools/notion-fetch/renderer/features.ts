export type RendererFeature =
  | 'figure'
  | 'callout'
  | 'details'
  | 'linkPreview'
  | 'embed'
  | 'stackblitz'
  | 'youtube'
  | 'tweet'
  | 'katex'
  | 'mermaid';

export const featureComponents: Record<RendererFeature, string> = {
  figure: 'Figure',
  callout: 'Callout',
  details: 'Details',
  linkPreview: 'LinkPreview',
  embed: 'Embed',
  stackblitz: 'Stackblitz',
  youtube: 'Youtube',
  tweet: 'Tweet',
  katex: 'Katex',
  mermaid: 'Mermaid',
};

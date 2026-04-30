type RssCategoriesInput = {
  channels: string[] | undefined;
  tags: string[];
};

export function buildRssCategories({ channels, tags }: RssCategoriesInput): string[] {
  return [...(channels ?? []), ...tags];
}

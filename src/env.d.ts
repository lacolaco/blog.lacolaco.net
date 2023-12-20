/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="gtag.js" />

interface ImportMetaEnv {
  readonly NOTION_AUTH_TOKEN: string;
  readonly NOTION_DATABASE_ID: string;
}

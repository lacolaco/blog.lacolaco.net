/// <reference path="../worker-configuration.d.ts" />
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="gtag.js" />

interface ImportMetaEnv {
  readonly PRODUCTION?: boolean;
  readonly NOTION_AUTH_TOKEN: string;
  readonly NOTION_DATABASE_ID: string;
}

/**
 * Environment Variables Typing for `locals.env`
 */
type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface CacheStorage {
  // https://developers.cloudflare.com/workers/runtime-apis/cache/
  default: Cache;
}
declare const caches: CacheStorage;

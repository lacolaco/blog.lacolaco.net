/// <reference path="../worker-configuration.d.ts" />
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="gtag.js" />

declare module '*.wasm' {
  const value: string;
  export default value;
}

interface ImportMetaEnv {
  readonly PRODUCTION?: boolean;
  readonly NOTION_AUTH_TOKEN: string;
  readonly NOTION_DATABASE_ID: string;
}

type Runtime = import('@astrojs/cloudflare').Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {
    env: {
      OG_IMAGE_SERVICE_URL: string;
    }
  }
}
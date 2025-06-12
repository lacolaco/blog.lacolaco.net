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

/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
/// <reference types="gtag.js" />
/* eslint-enable @typescript-eslint/triple-slash-reference */

interface ImportMetaEnv {
  readonly PRODUCTION?: boolean;
  readonly NOTION_AUTH_TOKEN: string;
  readonly NOTION_DATABASE_ID: string;
}

// Typing for `process.env`
declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * Google Cloud Storageのバケット名
     * OG画像のキャッシュに使用する
     */
    readonly GCS_BUCKET_NAME: string;
  }
}

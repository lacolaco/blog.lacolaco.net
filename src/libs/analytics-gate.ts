/// <reference types="gtag.js" />

export const GA_MEASUREMENT_ID = 'G-0BEKSBSM5X';

/** 部分一致だと blog.lacolaco.net.evil.com などが通るので完全一致で判定する */
const PRODUCTION_HOSTNAME = 'blog.lacolaco.net';

export function isProductionHost(hostname: string): boolean {
  return hostname.toLowerCase() === PRODUCTION_HOSTNAME;
}

export interface GtagWindow {
  dataLayer?: unknown[];
  gtag?: Gtag.Gtag;
  pushToDataLayer?: Gtag.Gtag;
}

export interface InitAnalyticsOptions {
  hostname: string;
  win: GtagWindow;
  loadScript: (src: string) => void;
  gtagProps?: object;
}

export function initAnalytics({ hostname, win, loadScript, gtagProps }: InitAnalyticsOptions): boolean {
  if (!isProductionHost(hostname)) return false;
  if (!win.pushToDataLayer) return false;
  win.gtag = win.pushToDataLayer;
  win.gtag('js', new Date());
  win.gtag('config', GA_MEASUREMENT_ID, gtagProps ?? {});
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`);
  return true;
}

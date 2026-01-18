import { isTweetUrl } from '../shared/embed';

// 設定インターフェース
interface EmbedConfig {
  youtube: {
    width: number;
    height: number;
    allowAttributes: string[];
  };
  webpage: {
    timeout: number;
    fallbackTitle: string;
  };
  tweet: {
    fallbackText: string;
  };
  stackblitz: {
    width: string;
    height: number;
  };
  googleSlides: {
    width: string;
    height: number;
  };
}

// 埋め込みハンドラーのインターフェース
interface EmbedHandler {
  name: string;
  test: (url: string) => boolean;
  transform: (url: string) => Promise<string | undefined> | string;
}

// 埋め込みハンドラーファクトリ関数
function createTweetHandler(): EmbedHandler {
  return {
    name: 'tweet',
    test: (url: string) => isTweetUrl(url),
    transform: (url: string) => {
      const safeUrl = new URL(url);
      // 埋め込みウィジェットは `twitter.com` にしか対応していないため、強制的に `twitter.com` に変換
      if (safeUrl.host !== 'twitter.com') {
        safeUrl.host = 'twitter.com';
      }
      return `
<div class="block-link block-link-tweet">
  <blockquote class="twitter-tweet">
    <a href="${safeUrl.toString()}">${safeUrl.toString()}</a>
  </blockquote>
</div>
      `.trim();
    },
  };
}

function createYouTubeHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'youtube',
    test: (url: string) => {
      return (
        url.startsWith('https://youtube.com/') ||
        url.startsWith('https://www.youtube.com/') ||
        url.startsWith('http://youtube.com/') ||
        url.startsWith('http://www.youtube.com/') ||
        url.startsWith('https://youtu.be/') ||
        url.startsWith('http://youtu.be/')
      );
    },
    transform: (url: string) => {
      const defaultYouTubeConfig = {
        width: 560,
        height: 315,
        allowAttributes: [
          'accelerometer',
          'autoplay',
          'clipboard-write',
          'encrypted-media',
          'gyroscope',
          'picture-in-picture',
        ],
      };
      const youtubeConfig = { ...defaultYouTubeConfig, ...config.youtube };

      const match = url.match(
        /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      );
      const videoId = match ? match[1] : undefined;
      if (!videoId) {
        // 動画IDが取得できない場合は無視
        console.warn(`Non-video YouTube URL: ${url}`);
        return '';
      }

      const { width, height, allowAttributes } = youtubeConfig;
      const allowAttributesStr = allowAttributes.join('; ');

      const embedUrl = new URL('https://www.youtube.com/embed/');
      embedUrl.pathname += videoId;

      return `
<div class="block-link block-link-youtube">
  <iframe
    width="${width}"
    height="${height}"
    src="${embedUrl.toString()}"
    style="border: none;"
    allow="${allowAttributesStr}"
    allowfullscreen
  ></iframe>
</div>
      `.trim();
    },
  };
}

function createStackblitzHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'stackblitz',
    test: (url: string) => {
      if (!url.startsWith('https://stackblitz.com/')) {
        return false;
      }
      // embed=1パラメータがある場合のみiframe化する
      const urlObj = new URL(url);
      return urlObj.searchParams.get('embed') === '1';
    },
    transform: (url: string) => {
      const defaultStackblitzConfig = {
        width: '100%',
        height: 400,
      };
      const stackblitzConfig = { ...defaultStackblitzConfig, ...config.stackblitz };

      const { width, height } = stackblitzConfig;
      const safeUrl = new URL(url);

      return `
<div class="block-link block-link-stackblitz">
  <iframe
    width="${width}"
    height="${height}"
    src="${safeUrl.toString()}"
    style="border: none;"
    loading="lazy"
  ></iframe>
</div>
      `.trim();
    },
  };
}

function createGoogleSlidesHandler(config: EmbedConfig): EmbedHandler {
  return {
    name: 'googleSlides',
    test: (url: string) => {
      if (!url.includes('docs.google.com/presentation')) {
        return false;
      }
      try {
        const urlObj = new URL(url);
        return urlObj.pathname.endsWith('/pub');
      } catch {
        return false;
      }
    },
    transform: (url: string) => {
      const defaultGoogleSlidesConfig = {
        width: '100%',
        height: 480,
      };
      const googleSlidesConfig = { ...defaultGoogleSlidesConfig, ...config.googleSlides };

      const { width, height } = googleSlidesConfig;
      // パス末尾の/pubを/embedに変換（クエリパラメータは保持）
      const urlObj = new URL(url);
      urlObj.pathname = urlObj.pathname.replace(/\/pub$/, '/embed');
      const embedUrl = urlObj.toString();

      return `
<div class="block-link block-link-google-slides">
  <iframe
    width="${width}"
    height="${height}"
    src="${embedUrl}"
    style="border: none;"
    allowfullscreen
    loading="lazy"
  ></iframe>
</div>
      `.trim();
    },
  };
}

function createDefaultHandler(): EmbedHandler {
  return {
    name: 'default',
    test: (url: string) => {
      return url.startsWith('https://') || url.startsWith('http://');
    },
    transform: (url: string) => {
      // URLが `/` から始まる場合は、相対URLとして扱い、本番ドメインを付加する
      const safeUrl = new URL(url); // 本番ドメインを付加

      return `
<div class="block-link block-link-default">
  <iframe src="/embed?url=${safeUrl.toString()}" loading="lazy"></iframe>
</div>`.trim();
    },
  };
}

// 埋め込みハンドラーの定義（設定を受け取る関数として）
export function createEmbedHandlers(config: EmbedConfig): EmbedHandler[] {
  return [
    createTweetHandler(),
    createYouTubeHandler(config),
    createStackblitzHandler(config),
    createGoogleSlidesHandler(config),
    createDefaultHandler(), // 最も広範囲なので最後に配置
  ];
}

export type { EmbedConfig, EmbedHandler };

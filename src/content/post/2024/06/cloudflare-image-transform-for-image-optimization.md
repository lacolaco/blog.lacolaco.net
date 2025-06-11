---
title: 'Cloudflare Image Transformationで画像最適化した'
slug: 'cloudflare-image-transform-for-image-optimization'
icon: ''
created_time: '2024-06-23T00:52:00.000Z'
last_edited_time: '2024-07-10T12:15:00.000Z'
category: 'Tech'
tags:
  - 'Cloudflare'
  - 'Blog Dev'
  - 'Astro'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Cloudflare-Image-Transformation-6d1b50f2cb2442fb94d87a1fc04688b6'
features:
  katex: false
  mermaid: false
  tweet: false
---

このブログで表示する画像の最適化について、以前にAstroの組み込み機能を使った記事を書いた。

https://blog.lacolaco.net/posts/8892acbcdb0e/

今回、Astroの画像最適化機能を使うのを完全にやめて、CloudflareのImage Transformationを使うことにした。背景にはAstroのビルド時間の肥大化がある。SSRではなく静的サイトとしてビルドしている都合上、すべての記事のすべての画像をビルド時に変換することになる。そのせいでブログのデプロイ時間が数分かかるようになってしまい、CI/CDが詰まるようになった。せっかくCloudflare Pagesのプレビューデプロイをしているのにプッシュから数分待たないといけないのは体験が悪すぎるので、この機能を使うのをやめた。

つまり画像最適化をビルド時ではなくオンデマンドでやるようにすればいいのだが、すでにホスティングにCloudflare Pagesを使っているのでそのままCloudflare Imagesを使うことにした。

https://developers.cloudflare.com/images/

画像はAstroの静的ファイルとしてCloudflare Pagesにアップロードするのが楽だから、追加で画像ストレージにアップロードするのは面倒だった。なので今回はストレージなしで画像変換プロキシとしてだけ使えるImage Transformation機能を使うことにした。

https://developers.cloudflare.com/images/transform-images/

いろいろ試行錯誤してみたが、Cloudflare PagesのFunctionでは自分自身でホストしている静的ファイルに対して Transform via Worker の機能は使えないようだった（そう書いてあったわけではないので方法を見つけられなかっただけかもしれない）。Transform via URLのほうは問題なく動いたので、そちらで実装している。

なんやかんや試していったん出来上がった形がこの `Image` コンポーネントである。現状では画像フォーマットの最適化と横幅によるリサイズだけを行っている。

[https://github.com/lacolaco/blog.lacolaco.net/blob/main/src/components/content/Image.astro](https://github.com/lacolaco/blog.lacolaco.net/blob/main/src/components/content/Image.astro)

まず、CDNによる画像変換はキャッシュさせることが前提になるので、ローカルや未公開時点での画像を食わせてはいけない。そもそもプレビュー環境にはCloudflare Accessで保護をかけているので変換サーバーからアクセスできない。そういうことで本番環境でだけImage TransformationのURLに向けている。`env.PRODUCTION`は自分で追加した環境変数で、ビルド自体は本番相当でもプレビュー環境用の場合は`false`になる。

```ts
function imageLoader(config: { src: string; width: number }): string {
  const { src, width } = config;
  if (!env.PRODUCTION) {
    return src;
  }

  const params = ['format=auto'];
  if (width) {
    params.push(`w=${width}`);
  }

  return `https://blog.lacolaco.net/cdn-cgi/image/${params.join(',')}/${src}`;
}
```

あとはこのURLを`img`タグの`src`に指定するだけだが、せっかくなのでレスポンシブに適切なサイズの画像をダウンロードするように`srcset`を指定した。また、画像ファイルはビルド時に存在するので、元画像の縦横のサイズだけは取得して`width`属性と`height`属性を設定した。これにより縦横比が確定し、レスポンシブであっても横幅を基準にして高さが決まるのでレイアウトシフトが起こらない。Astro（Vite）の環境で画像ファイルをモジュールとしてインポートするとサイズが手に入るのは非常に便利だ。

```ts
      <img
        class:list="object-contain w-full md:max-w-screen-md max-h-[50vh]"
        src={`/images/${image.path}`}
        {...await getLocalImageSize(image.path)}
        srcset={[
          `${imageLoader({ src: `/images/${image.path}`, width: 640 })} 640w`,
          `${imageLoader({ src: `/images/${image.path}`, width: 768 })} 768w`,
          `${imageLoader({ src: `/images/${image.path}`, width: 1024 })} 1024w`,
        ].join(',')}
        alt={...}
        loading="lazy"
        decoding="async"
      />
```

```ts
async function getLocalImageSize(src: string): Promise<{ width: number; height: number }> {
  const getImage = localImages[`/public/images/${src}`];
  if (!getImage) {
    throw new Error('Image not found');
  }
  const { width, height } = await getImage().then((m) => m.default);
  if (!width || !height) {
    throw new Error('Failed to get image size');
  }
  return { width, height };
}
```

コードは整理できる余地はあるが、いったんブログの仕組みとしては納得いく形になった。ビルド時間もプッシュから1分程度でプレビュー環境がデプロイされるくらいに短縮できたので満足である。まだ時間がかかっているのはOGPの画像生成をこれもビルド時に全記事処理しているからで、これもオンデマンド生成+CDNキャッシュに切り替えることでもっと短縮できる見込みがある。

最後に画像最適化のサンプルとして、これは昨日の隅田川である。

![image](/images/cloudflare-image-transform-for-image-optimization/Untitled.png)

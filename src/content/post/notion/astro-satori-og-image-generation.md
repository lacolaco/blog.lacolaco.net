---
title: 'satoriを使ったAstroのOGP画像生成メモ'
slug: 'astro-satori-og-image-generation'
icon: ''
created_time: '2023-06-06T23:35:00.000Z'
last_edited_time: '2023-12-30T10:04:00.000Z'
tags:
  - 'Astro'
  - 'Blog Dev'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/satori-Astro-OGP-d23a2cfd5a4647f6a4300533e00371a6'
features:
  katex: false
  mermaid: false
  tweet: false
---

## TL;DR

- SVG to PNG の変換は shape だとビルドエラーになり、@resvg/resvg-js を使った
  - Vite内部のなんらかのエラーでデバッグも難しくこれ以上の深掘りは諦めた
- satoriに読み込ませるフォントファイルはウェイトごとにそれぞれ分ける
  - Google Fontsのクエリパラメータの `wght@400;700` は最初の一つしか機能しなかった

## やったこと

- satori, @resvg/resvg-js のインストール
- `npx astro add react` 
  - satoriに食わせるJSXを書くため
  - astro.config.js への変更もやってくれるので astro add を使うのが楽でよい
- `[slug].png.ts` エンドポイントの作成
  - ブログ記事ごとに対応したPNG画像を返却するためのエンドポイント
- SVGを生成してPNGに変換して返す
  - satori + @resvg/resvg-js
  - @resvg/resvg-js が内部で `.node` ファイルをロードするところで `astro dev` コマンドが死んでしまったので、Astroの設定ファイルで `vite: { optimizeDeps: { exclude: ['@resvg/resvg-js'] } }`  を加えてViteの最適化対象から外した

## 結果

こんな感じの画像をビルド時に生成するようになった。ところで、Twitter Cardは最近は7日間キャッシュされるらしく、しばらくは反映が遅れそうだ。OGPの動作確認はDiscordに貼り付けるのが楽でよい。

![image](https://blog.lacolaco.net/og/angular-signals-component-design-patterns.png)

https://github.com/lacolaco/blog.lacolaco.net/blob/main/src/pages/og/[slug].png.ts

https://github.com/lacolaco/blog.lacolaco.net/blob/main/src/components/OgImage.tsx

## 参考にしたURL

https://zenn.dev/ikuma/scraps/2bd2b9dc3605d7

https://blog.70-10.net/posts/satori-og-image/


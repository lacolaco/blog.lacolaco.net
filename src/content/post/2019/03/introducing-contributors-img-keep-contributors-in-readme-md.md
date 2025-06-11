---
title: 'Introducing contributors-img: Keep contributors in README.md'
slug: 'introducing-contributors-img-keep-contributors-in-readme-md'
icon: ''
created_time: '2019-03-29T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'GitHub'
  - 'OSS'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Introducing-contributors-img-Keep-contributors-in-README-md-7c05b97b52b24509a1199c3f5fedd229'
features:
  katex: false
  mermaid: false
  tweet: false
---

Hey folks! I introduce a web app I’ve created, **contributors-img**. It generate an image to display contributors of your GitHub repository.

![image](https://thepracticaldev.s3.amazonaws.com/i/2by6h6z64d79gka4ncsd.png)

https://contrib.rocks/

## Why image?

Because images are only way to embed dynamic content in README.md on GitHub.

Once you paste the generated image’s URL in README.md, it will keep contributors list in sync without any effort.

It’s FREE to use for open source! And if you love it, please donate me via [Patreon](https://www.patreon.com/lacolaco)

Technically, contributors-img is built on top of Google Cloud Functions / Puppeteer / Angular / GitHub APIs.

## Caveats

- A repo having too many contributors takes a long time to generate an image.
- For each repository, images are generated once in a day and it will be cached for later requests.

Thanks!

---
title: 'ブックマークをSNSに投稿する #laco_feed を支える仕組み'
slug: 'inside-laco-feed'
icon: ''
created_time: '2023-08-19T10:56:00.000Z'
last_edited_time: '2026-03-28T07:39:00.000Z'
tags:
  - 'Cloudflare'
  - 'Notion'
  - '雑記'
published: true
locale: 'ja'
category: 'Tech'
channels:
  - 'Code'
notion_url: 'https://www.notion.so/SNS-laco_feed-69879d3d01444aa29d3b128b15689a53'
features:
  katex: false
  mermaid: false
  tweet: true
---

[Notion Web Clipper](https://www.notion.so/ja-jp/web-clipper) でブックマークしたURLを X (以下 Twitter) に自動投稿することを長らくやっている。

[https://twitter.com/search?q=%23laco_feed&f=live](https://twitter.com/search?q=%23laco_feed&f=live)

これまでは自動化に Zapier を使って完結していたのだが、SaaSを使ってTwitterに自動投稿することが難しくなってきた。今年のはじめにはZapierのプレミアムプランが必要になったが、[ついに8月末で完全に機能が消えることになった](https://help.zapier.com/hc/en-us/articles/18657531069965/)。

https://twitter.com/laco2net/status/1692672853580407093

代わりのSaaSを探してみたがなかなか見つからなかったのと、Misskeyへのクロスポストを最近別の仕組みで実装していたのと統一して、ついでに Bluesky にもクロスポストしようということで、全部作ることにした。思い立ってみたら一日で出来上がったので、その記録。

↓実際にクロスポストされたもの（Blueskyはログインしないと見れない）

https://twitter.com/laco2net/status/1692872915610677677

https://misskey.io/notes/9iljr6hhnh

https://bsky.app/profile/lacolaco.bsky.social/post/3k5cqgzf6hm2r

## 全体像

![image](/images/inside-laco-feed/PXL_20230819_1114158082.984afdd50dfa7c89.jpg)

- Cloudflare Workers
  - 主役。すべてここで動いている。しかも無料枠。
  - Cron Trigger機能で、5分ごとに実行することにしている
  - 各種APIの秘密鍵やトークンは全部 Cloudflare Worker 側に保存して暗号化したものを流し込んでいる
    - [https://developers.cloudflare.com/workers/configuration/environment-variables/#add-secrets-to-your-project](https://developers.cloudflare.com/workers/configuration/environment-variables/#add-secrets-to-your-project)
- Notion
  - ブックマークしたURLはここに保存されている。
  - Cloudflare WorkersからNotion APIを呼び出して使用する
  - クロスポスト処理が済んだアイテムはNotion DBの方に処理済みフラグを書き込んで、複数回処理されないようにしている
- クロスポスト先
  - Misskey API
  - Bluesky (AT Protocol)
  - Twitter API v2 (無料プラン)

別にOSSとして使えるとは思っていないが、隠す理由が特にないので公開レポジトリにした。

https://github.com/lacolaco/feed2social

## クロスポスト実装

### Misskey

Misskey のAPIは、ActivityPubのメンタルモデルがだいたいわかっていれば、あとはエンドポイントごとのドキュメントを読めば特に困ることはない。Misskey APIの認証はシークレットトークンをリクエストボディの `i` フィールドにセットすればよい。

https://misskey-hub.net/docs/api/endpoints/notes/create.html

```typescript
/**
 * Post a message to Misskey.
 *
 * @see https://misskey-hub.net/docs/api/endpoints/notes/create.html
 */
export async function createMisskeyNote(item: FeedItem, authToken: string) {
  const text = `🔖 "${item.title}" ${item.url} #laco_feed`;
  await fetch('https://misskey.io/api/notes/create', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: text, i: authToken }),
  });
}
```

### Bluesky (AT Protocol)

Bluesky の機能はBlueskyが準拠しているAT Protocolによって呼び出せる。 `@atproto/api` パッケージを使えば特に困ることはない。

認証については、Blueskyの設定画面で発行できる “App Password” を使い、パスワード認証を行う。

参考にした記事:

https://www.memory-lovers.blog/entry/2023/07/09/152224

```typescript
import { BskyAgent, RichText } from '@atproto/api';

const bsky = new BskyAgent({ service: 'https://bsky.social' });

/**
 * Post a message to Bluesky.
 */
export async function createBlueskyPost(item: FeedItem, identifier: string, password: string) {
  await bsky.login({ identifier, password });

  const text = `🔖 "${item.title}" ${item.url}`;

  const rt = new RichText({ text });
  await rt.detectFacets(bsky);

  await bsky.post({ text: rt.text, facets: rt.facets });
}
```

### Twitter 

かなり苦戦した。ふつうの Node.js サーバーだったらもっと簡単だったが、Cloudflare Workersのエッジ環境であることで、クロスポスト先の中で一番OSSも豊富なはずのTwitter APIだが、全然先人の実装を利用できなかった。

投稿の文字列長を調整するのはazuさんの `tweet-truncator` を使わせてもらった。

https://github.com/azu/tweet-truncator

```typescript
import encBase64 from 'crypto-js/enc-base64';
import hmacSha1 from 'crypto-js/hmac-sha1';
import OAuth from 'oauth-1.0a';
import { truncate } from 'tweet-truncator';

/**
 * Post a message to Twitter.
 *
 * @see https://developer.twitter.com/en/docs/twitter-api/tweets/manage-tweets/api-reference/post-tweets
 */
export async function createTwitterPost(
  item: FeedItem,
  credentials: { consumerKey: string; consumerSecret: string; accessToken: string; accessSecret: string },
) {
  const text = truncate(
    { title: item.title, url: item.url, tags: ['#laco_feed'] },
    {
      defaultPrefix: '🔖',
      template: '"%title%" %url% %tags%',
      truncatedOrder: ['title'],
    },
  );

  const req: OAuth.RequestOptions = {
    url: 'https://api.twitter.com/2/tweets',
    method: 'POST',
    data: { text },
    includeBodyHash: true, // v1.1における `include_entities` に相当
  };

  const oauth = new OAuth({
    consumer: { key: credentials.consumerKey, secret: credentials.consumerSecret },
    signature_method: 'HMAC-SHA1',
    hash_function(base_string, key) {
      return hmacSha1(base_string, key).toString(encBase64);
    },
  });

  const oauthHeader = oauth.toHeader(oauth.authorize(req, { key: credentials.accessToken, secret: credentials.accessSecret }));
  const resp = await fetch(req.url, {
    method: req.method,
    headers: {
      'Content-Type': 'application/json',
      ...oauthHeader,
    },
    body: JSON.stringify(req.data),
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error(body);
    throw new Error(`failed to post to Twitter`);
  }
}
```

## Cloudflare Workers では `node:crypto` が使えない問題

Twitter API v2にリクエストを送るにあたり、OAuth 1.0aに準拠する必要があったが、これに手こずった。なぜかというと、npmに上がっている多くのTwitter APIクライアント実装や、OAuth 1.0実装の多くがNode.jsの `crypto` モジュールに依存しているからだ。具体的には署名を作成する際のハッシュ形式が `HMAC-SHA1` なので、その実装に `crypto.createHmac` が使われているわけだが、これが Cloudflare Workers にはない。

Cloudflare Workers には `node_compat` という機能があり、Node.js APIをポリフィルしてくれるのだが、残念ながら `crypto.createHmac` は含まれていなかった。Cloudflare Workersは WebCrypto APIのサポートはあるのだが、このAPIでは HMAC-SHA1 形式でハッシュ生成 (digest) することはできなさそうだった。

https://developers.cloudflare.com/workers/runtime-apis/nodejs/

https://developers.cloudflare.com/workers/runtime-apis/web-crypto/#supported-algorithms

結局どうしたかというと、 `oauth-1.0a` というライブラリと、 `crypto-js` というライブラリの合わせ技で解決できた。

https://www.npmjs.com/package/oauth-1.0a

https://www.npmjs.com/package/crypto-js

`oauth-1.0a` は OAuth 1.0aのヘッダ生成や署名の実装をしているが、ハッシュ関数部分だけ外から注入するように設計されている。なので、このライブラリは `crypto` に依存しておらず Worker でも使える。

あとは HMAC-SHA1 形式のハッシュ生成ができる実装があればよいので、 `crypto-js` からその部分を借りた。 `crypto-js` は Node.js でも browser でも使える、ということは当然 Node.js の標準モジュールには依存していないのである。

## 所感

- 自分で作れば無料！
- どれもカテゴリとしては近いWebサービスなのに、認証方法もAPIのデザインも全然違うのでクロスポスト実装すると多様性が感じられる。


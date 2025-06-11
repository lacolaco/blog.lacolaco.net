---
title: 'Cloudflare Workers + HonoでDiscord botを作る際のポイント'
slug: 'discord-bot-cfworkers-hono'
icon: ''
created_time: '2023-09-22T23:17:00.000Z'
last_edited_time: '2023-12-30T10:00:00.000Z'
category: 'Tech'
tags:
  - 'Discord'
  - 'Cloudflare'
  - 'Hono'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Cloudflare-Workers-Hono-Discord-bot-41e326de5455488cb731732e45de6e0e'
features:
  katex: false
  mermaid: false
  tweet: false
---

タイトルの通り。普通にNode.jsのWebサーバーを立てて実装するときとは違う注意点がいくつかあった。当然制約が強い環境ではあるが、それを差し引いてもCloudflare + Honoは開発・運用しやすいので、結果的には満足している。

ちなみに、公式ドキュメントでもCloudflare WorkersでのBotの作り方のガイドはあるが、これはExpress前提なので、Honoユーザーはいろいろと読み替える必要がある。

[https://discord.com/developers/docs/tutorials/hosting-on-cloudflare-workers](https://discord.com/developers/docs/tutorials/hosting-on-cloudflare-workers)

## discord.js は使えない

Discord botをJavaScriptで実装しようと思ったら普通 discord.js を使うが、このライブラリは現状Node.jsランタイムに強く依存しているため、Cloudflare WorkersではNode.js互換モードでも使えない。

https://github.com/discordjs/discord.js

ではどうするかというと、2つ使えるライブラリがある。ひとつは、discord.jsのベースになっているdiscord-api-typesパッケージ。これはその名の通りDiscord APIのTypeScript型定義だけが提供されている。

https://github.com/discordjs/discord-api-types/

もうひとつはdiscord-interactions-jsパッケージ。これはDiscord Botの Interactions endpointを実装するのに便利なモジュールを提供している。

https://github.com/discord/discord-interactions-js

Cloudflare Workersはリクエストのたびに実行するモデルなので、サーバーを起動しっぱなしにしてイベントをストリーミングすることができない。なので必然的にBotはInteractions Endpoint URLを介してクライアントとやりとりするしかない。

![image](/images/discord-bot-cfworkers-hono/Untitled.png)

つまり、結局POSTリクエストを受け取ってレスポンスを返すにはWebサーバーを作る必要があり、Cloudflare WorkersでそれをやるならぜひHonoを使いたい。めっちゃ書きやすいので。

https://hono.dev/

## リクエストの検証のためにbodyをクローンして読む

Interactions Endpointを介してクライアントとBotがやり取りするにあたって、エンドポイントに送られてきたリクエストが正しくDiscordのクライアントで作成されたものかを検証することが推奨されている。そうでないと単なるPOSTのエンドポイントなので、いくらでも偽造ができる。

https://discord.com/developers/docs/interactions/receiving-and-responding#security-and-authorization

この検証処理はdiscord-interactions-jsが `verifyKey` 関数として提供しているのでそれを使うと楽。 `verifyKeyMiddleware` というものも提供しているがこれは Express 互換のサーバーにミドルウェアとして使えるもので、今回はHonoを使うので見送る。

ということで、Honoで使えるミドルウェアは自作する必要がある。やることは `X-Signature-Ed25519` ヘッダと `X-Signature-Timestamp` ヘッダの値を取り出し、それとリクエストのボディをあわせてBotのPublic Keyとともに `verifyKey` 関数を呼び出すこと。実装は次のようになった。

```ts
const verifyKeyMiddleware = (): MiddlewareHandler<{ Bindings: Env }> => async (c, next) => {
  const signature = c.req.header('X-Signature-Ed25519');
  const timestamp = c.req.header('X-Signature-Timestamp');
  const body = await c.req.raw.clone().text();
  const isValidRequest = signature && timestamp && verifyKey(body, signature, timestamp, c.env.DISCORD_PUBLIC_KEY);
  if (!isValidRequest) {
    console.log('Invalid request signature');
    return c.text('Bad request signature', 401);
  }
  return await next();
};
```

ここでポイントは、ミドルウェアでそのまま `c.req.text()` のようにボディを読んでしまうと、後続のリクエストハンドラでボディを読もうとしたときにエラーになるため、一度 `clone()` してからボディを読むこと。 `c.req` の HonoRequest オブジェクトは `clone()` を持っていないので、内部の `c.req.raw` をクローンしている。これは `c.req.clone()` ができるとスッキリするなあと思ったのでHonoにIssueを上げようかと思っている。

…と書きながら考えていたのだが、調べてみると最新のHonoならリクエストボディの読み込みは内部でキャッシュされるため `c.req.text()` をミドルウェアで読んでもいいことになっているようだ。改めてアプリケーションの問題なのかHonoの不具合を踏んだのか調べる必要がありそうだ。

https://github.com/honojs/hono/pull/1333

https://github.com/honojs/hono/pull/1393

## Deferred Messageは使えない

これはCloudflare Workersを無料あるいは安めのプランで使う場合の制約で、ガッツリ有料で使うなら関係なさそう。リクエストが届いてワーカーが起動してから、レスポンスを返してワーカーが終了するまでのCPU時間は10msなので、それ以上の時間がかかる応答はできない。

[https://developers.cloudflare.com/workers/platform/limits/#worker-limits](https://developers.cloudflare.com/workers/platform/limits/#worker-limits)

なので、DiscordのBotでできることはクライアントからのInteractionsに対して即レスポンスを返すだけで、Deferred Messageを返しておいて時間差でFollow upするような振る舞いは厳しい。だいたいタイムアウトする。

1つのリクエストに対して1つのレスポンスを返して終わるタイプのBotじゃないとCloudflare Workersで実装するのは難しいだろう

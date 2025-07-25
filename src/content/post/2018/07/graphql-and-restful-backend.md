---
title: 'GraphQLとRESTfulについて今日考えてたこと　Backend for Usecase/Resourceについて'
slug: 'graphql-and-restful-backend'
icon: ''
created_time: '2018-07-13T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - '雑記'
  - 'GraphQL'
  - '設計'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/GraphQL-RESTful-Backend-for-Usecase-Resource-d55bc2a74dc7443199247ff1d5610666'
features:
  katex: false
  mermaid: false
  tweet: false
---

DISCLAIMER: これは本当にただのメモ書きで、これがベストプラクティスだとかいう話ではないので、同じようなことを考えてる人いたら今度議論しましょうよ、って程度の話の種。

GraphQL を使うべきスポット、RESTful が好ましいスポットについて今日ぼんやり考えていて、なんとなく言語化ができる気がするので文字起こししてみる。

## Backend for Usecase と Backend for Resource

バックエンドの API には 2 種類あって、

- 「データ」を構成する「リソース」を提供するもの
- アプリケーションの「ユースケース」がもつシナリオのなかで登場する「データ」部分を埋めるためのもの

を区別することが必要そう、と思っている。

まず前者を **Backend for Resource** (BFR)と呼ぶことにする。これはわかりやすくて、これはまさしく RESTful そのもの。 RDB やそうじゃない DB、あるいはファイルストレージかもしれない永続化されたリソースに URI を付与し、外部からアクセス可能にするのが役目。 BFR の設計はリソースのスキーマに依存する。

次の後者を **Backend for Usecase** (BFU)と呼ぶことにする。これが GraphQL が向いていそうなところ。 フロントエンドのユースケースのなかで、永続化されたデータが必要になった時の問い合わせ先。 つまり、BFU の設計はフロントエンドのユースケースに依存する。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180712/20180712230727.png)

## なんで分けたいのか

BFF の文脈でいろんな理由が挙げられているとは思うが、個人的にはそのシステム自体のライフサイクルの違いに合わせた分割が、柔軟な開発サイクルを支えてくれるんじゃないかと思っている。

フロントエンドはユーザーが触れる最前線にあるので、UX の改善、ユースケースの再設計は成長段階のプロダクトにおいて頻繁に発生する。 フロントエンドについては一旦諦めるとして、バックエンドの中には、そうしたユースケースの再設計に巻き込まれてもしょうがない部分とそうでもなさそうな部分がある。 前者が、「ユースケースに対するデータプロバイダー」としてのバックエンド、つまり上述の BFU で、後者が「リソースコンテナ」としてのバックエンド、つまり BFR じゃないかと思う。

ユースケースが再設計されたとしても、リソース自体に変化があるわけじゃないなら、その部分は残したい。ユースケースに依存する範囲を明確に分けたい、というのが僕の BFU/BFR に対するモチベーションの大きな部分。 その境界でバックエンドのサーバーごと分けてしまうというのは、昨今のコンテナ化の流れにもマッチしてそうな気がする。

## なんで BFU は GraphQL がよさそうか

フロントエンドのユースケースの中では目的が必ず存在してデータ要求が生まれる。 すごく単純化したら「ID=2 の User のデータがほしい」ではなく「ID=2 のユーザーの名前を表示するためのデータがほしい」という話で、そのユースケースにとってはユーザーの名前が User テーブルの Name カラムに保存されているとかそんなことはどうでもよく、ただユーザーの名前がほしい、というニーズだけがある。

BFU がない場合は、フロントエンドのなかで BFR から受け取ったデータをユースケースに合った形に自分で整形することになる。あるいは BFR が拡張されてユースケースを受け入れはじめるかのどちらか。

BFU がある場合は、フロントエンドは BFU にユースケースを投げつける。ユースケースを定義するのはフロントエンドの仕事なので、GraphQL のようにフロントエンドでほしいデータの形を定義するのがマッチするはず。

フロントエンド、BFU、BFR が分かれたとき、それぞれのシステムのライフサイクルは次のようになる。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180713/20180713000156.png)

悲しいことにフロントエンドはまっさきに壊されるが、それは宿命として諦めるとして、BFU があることで BFR は長生きすることができる。

## やっちゃいけないこと

BFU は「ユースケースに対するデータプロバイダー」としてのバックエンドであるから、常に実装の要件はフロントエンドのユースケースによって決定される。 そのため、次のことはやってはいけない。

- 「DB からデータが取れるから」というボトムアップで実装すること
  - 本来依存しなくてもよい部分に BFR への依存が発生する。
- 複数のユースケースをひとつの query で対応しようとする
  - たまたまスキーマが似ているだけで DRY 的にまとめるのは本来関係をもつはずのないユースケース間の関係を生んでしまう

**BFU は常にアプリケーションのために存在するが、BFR はアプリケーションが無くても成立する。**

---

とりあえずここまで。今日 10 分くらい会社で ryopeko さんと雑談してたネタなのであまりしっかり練った考えではないけど、こんな感じのシステムを作って試してみたい。

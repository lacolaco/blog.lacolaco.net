---
title: 'Signals 雑記 (2023-06-21)'
slug: 'signals-memo-20230621'
icon: ''
created_time: '2023-06-08T00:09:00.000Z'
last_edited_time: '2023-12-30T10:04:00.000Z'
category: 'Tech'
tags:
  - '雑記'
  - 'Signals'
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Signals-2023-06-21-83989f98b8c5470db41490f097702ea3'
features:
  katex: false
  mermaid: false
  tweet: true
---

https://twitter.com/laco2net/status/1671341278246887425

https://twitter.com/laco2net/status/1671342944878759937

https://twitter.com/laco2net/status/1671343903453364224

- Signalがプリミティブであるということの意味
  - プリミティブとそうでないものの違い=遍在性
  - どこで使われていてもおかしくない原始的な構成要素
  - Angular Signalsがリアクティビティプリミティブであるなら、Angular Signals はAngularアプリケーションのどこにどう登場してもおかしくない
  - たとえドメイン層であっても
- 脱State, 脱Store
  - State, Store というメンタルモデル
  - JavaScriptでオブジェクトの状態の変化に対して反応的であるためには、なんらかの仕組みが必要
    - Pull型でいえばポーリング、tick + dirty checking
      - 変化の有無を都度検出する
    - Push型でいえばイベントリスナー、Observerパターン
      - 変化されたことを通知される
  - あるオブジェクトについて、そのオブジェクトの変更を追跡するために外付けされるアダプターとして、Store というパターンが使われてきた
    - Store パターンの本質はオブジェクトに対する変更(mutation)経路の制限
    - 変更経路を絞ることで、変更されたときに確実に通知できる
  - Store パターンを再利用可能な部品として実装しようとすると、あるひとまとまりのオブジェクトに対するポリモーフィックな設計になる
    - `Store<T>`
    - この `T` がすなわち State
    - Store パターンが State という分節単位を要求する
  - ところが、Signalsはオブジェクトそれ自体が変更を通知する、「物言うオブジェクト」
    - 変更を追跡するために追加の仕組みを必要としない
    - つまり、Storeが不要
    - Storeが不要であるなら、同時に State という分節単位も不要
      - State に組み入れられていたひとつひとつのオブジェクトが、それぞれ独立して状態として振る舞える
  - そのような意味における脱State, 脱Store
    - 実際には、細分化、to be fine-grained
- "状態管理"はもはや責務ではなくなった
  - Signalsによって、Observerパターンがプリミティブとして状態オブジェクトそのものに組み込まれた
  - もはや独立したメカニズムとして外部化できるものではなくなる
    - 分離可能な関心事ではなくなる
  - Signals以後に残るのは、自律分散的に存在するそれぞれの状態オブジェクトが、互いにどのように関係するかというネットワークの構築か
    - オブジェクト同士のP2P的な依存マップを設計する

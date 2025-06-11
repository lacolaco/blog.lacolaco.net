---
title: 'AngularのDeferred Viewで時限式ビューを作る'
slug: 'angular-defer-scheduled-view'
icon: ''
created_time: '2024-08-27T12:13:00.000Z'
last_edited_time: '2024-09-04T09:48:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-Deferred-View-50321da164af49878a8f24041e7761af'
features:
  katex: false
  mermaid: false
  tweet: false
---

mizdraさんのブログに触発されて、特定の日時を過ぎるまでは秘匿されなければならないビューをクライアントサイドだけで実装する方法を考えた。

https://www.mizdra.net/entry/2024/08/27/190853

Angularには `@defer` 構文によってチャンク分割したコンポーネントを遅延読み込みする機能があるため、これを使うと似たようなことができるのではと思い、実験してみた。

## 実装

まずは秘匿されるコンテンツをひとつのコンポーネントにまとめる。今回は `CampaignMessage` とした。このコンポーネントは遅延読み込みされる側なので特別な実装はなにもない。

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'campaign-message',
  standalone: true,
  template: ` <p>Happy New Year!</p> `,
})
export default class CampaignMessage {}
```

このコンポーネントを遅延読み込みする側でスケジュールを管理する必要がある。 `@defer` にはビルトインの `on` トリガーもあるが、 `when` で任意のトリガーを実装できる。 `when` トリガーには評価するとブール値が返されるような式を渡せばよく、はじめて評価結果が True になったときに遅延読み込みが開始される。評価結果が False の間は `@placeholder` の内容が表示される。

https://angular.jp/guide/defer#トリガー

```ts
import CampaignMessage from './campaign';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CampaignMessage],
  template: `
    @defer (when isOpen("2024-01-01")) {
      <campaign-message />
    } @placeholder {
      <p>Stay tuned!</p>
    }
  `,
})
export class App {
  isOpen(shownAt: string) {
    return new Date() >= new Date(shownAt);
  }
}
```

`@defer` ブロックによってJavaScriptファイルが分割されているため、トリガーが発火するまでにブラウザからダウンロードされるファイルにはキャンペーン内容は含まれていない。ただし遅延読み込みするコード（実体は結局 `import()` ）は含まれているのでそこからファイルパスを引き抜かれたら直接ダウンロードされてしまうリスクはある。今回はその点については諦めた。

もともとの要件では、秘匿される情報はブラウザにダウンロードされるJavaScriptファイルの中に含めてはいけない。サーバーサイドがあるならAPIで返すなりSSRで埋め込むなりやりようはいろいろあるが、これをサーバーサイドなしでやろうとするとどこかで妥協は必要になる。そもそもデバイスの時計をいじられたらアウトだ。なので実用性はあまりないかもしれない。

また、あくまでも遅延読み込みされることを前提としており、どこか別の場所で `campaign.ts` をインポートして中身を静的に参照していたら当然一緒にバンドルされるので意味がない。

とはいえ `when` 条件を使う例としておもしろかった。実際に動作するサンプルも置いておく。

https://stackblitz.com/edit/stackblitz-starters-vrvpn4?ctl=1&embed=1&file=src/main.ts

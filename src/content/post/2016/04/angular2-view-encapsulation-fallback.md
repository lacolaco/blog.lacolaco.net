---
title: 'ViewEncapsulationのフォールバック'
slug: 'angular2-view-encapsulation-fallback'
icon: ''
created_time: '2016-04-10T00:00:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/ViewEncapsulation-5f9d3b12aa0a4be992e5c8c9e4f6f53b'
features:
  katex: false
  mermaid: false
  tweet: false
---

ブラウザがShadow DOMを実装している場合は`ViewEncapsulation.Native`を、 そうでない場合はデフォルトの`ViewEncapsulation.Emulated`を使うようにフォールバックを実装する方法。

### Shadow DOM Check

まずアプリケーション全体で統一の`ViewEncapsulation`を使うためにコンフィグ用の`default-view-encapsulation.ts`を用意します。 よくよく調べるとAngular2の`Native`はShadow DOM v1ではないようだけど、 `BrowserDomAdapter`経由で調べるのでAngular側がいつv1準拠になっても大丈夫にしてある。

```
import {ViewEncapsulation} from "angular2/core";
import {BrowserDomAdapter} from "angular2/platform/browser";

let domAdapter = new BrowserDomAdapter();

export var DEFAULT_VIEW_ENCAPSULATION = domAdapter.supportsNativeShadowDOM() ?
    ViewEncapsulation.Native : ViewEncapsulation.Emulated;
```

ChromeとSafariでしか見てないけどChromeのほうが若干初期ロードが速い気がする。 SharedStyleを使わない分JSでの処理が少ないだろうことは予想できる。


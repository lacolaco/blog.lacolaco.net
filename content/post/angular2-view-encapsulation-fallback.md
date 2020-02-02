+++
date = "2016-04-10T00:23:58+09:00"
title = "ViewEncapsulationのフォールバック"
slug = "angular2-view-encapsulation-fallback"
tags = [ "Angular2" ]

+++

ブラウザがShadow DOMを実装している場合は`ViewEncapsulation.Native`を、
そうでない場合はデフォルトの`ViewEncapsulation.Emulated`を使うようにフォールバックを実装する方法。

<!--more-->

### Shadow DOM Check

まずアプリケーション全体で統一の`ViewEncapsulation`を使うためにコンフィグ用の`default-view-encapsulation.ts`を用意します。
よくよく調べるとAngular2の`Native`はShadow DOM v1ではないようだけど、
`BrowserDomAdapter`経由で調べるのでAngular側がいつv1準拠になっても大丈夫にしてある。

```ts
import {ViewEncapsulation} from "angular2/core";
import {BrowserDomAdapter} from "angular2/platform/browser";

let domAdapter = new BrowserDomAdapter();

export var DEFAULT_VIEW_ENCAPSULATION = domAdapter.supportsNativeShadowDOM() ?
    ViewEncapsulation.Native : ViewEncapsulation.Emulated;

```

ChromeとSafariでしか見てないけどChromeのほうが若干初期ロードが速い気がする。
SharedStyleを使わない分JSでの処理が少ないだろうことは予想できる。
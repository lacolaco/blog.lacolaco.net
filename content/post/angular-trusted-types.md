---
title: 'Angular: Trusted Typesサポートの概要'
date: 2020-11-03T08:54:42+09:00
updated_at: 2020-11-03T08:54:42+09:00
tags: [angular, web, trusted-types, security, xss]
---

DOM の新しいセキュリティ機構として [Trusted Types][] という仕様が提案されている。
現在開発中の Angular v11 は Trusted Types の仕様に準拠し、Trusted Types をサポートしたブラウザではその機能が利用できるようになる予定だ。
この記事では Angular と Trusted Types がどのように関わるのかを解説する。

## Trusted Types とは

Trusted Types そのものが初見であれば、Jxck さんのブログ記事を先に読むことをおすすめする。

[安全な文字列であると型で検証する Trusted Types について \| blog\.jxck\.io](https://blog.jxck.io/entries/2019-01-27/trusted-types.html)

簡潔に言えば、文字列ベースでの DOM 操作が可能な API について、その文字列が信頼できるものであることをマークして、ブラウザに対してその DOM 操作が安全である（と開発者は信じている）ことを伝えるものだ。
具体的な API で言えば、 `element.innerHTML` や `script.src` などが挙げられる。

[CSP][]と併用することで、信頼できることがマークされていない文字列はブラウザがセキュリティポリシー違反としてブロックあるいはエラーを報告できるようになる。
検証目的であれば`index.html`の `<head>`タグ内に次の HTML を追加すれば簡単に Trusted Types の動作を確認できる。

```html
<meta
  http-equiv="Content-Security-Policy"
  content="require-trusted-types-for 'script';"
/>
<script>
  window.addEventListener(
    'securitypolicyviolation',
    console.error.bind(console)
  );
</script>
```

## Angular と Trusted Types

実は以前にも Angular と Trusted Types について記事を書いている。

[DOM の XSS を防ぐ Trusted Types と Angular のセキュリティ機構](/2019/05/trusted-types-and-angular-security/)

この記事では Angular がビルトインで持つ独自のセキュリティ機構と、Trusted Types がどのようにかかわる可能性があるかを少し述べた。
まず Angular の `DomSanitizer` についての基本的な理解が必要となるため、理解が不安であればまずはこちらを読んでほしい。

### DomSanitizer と Trusted Types

`DomSanitizer` は、任意の文字列が信頼できる HTML、スクリプト、CSS などであることを、開発者が Angular に伝えるための API だ。
たとえば `innerHTML` への文字列の挿入で `<iframe>` タグを残してほしければ、次のように文字列が安全な HTML であるとマークする。

```ts
import { Component } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

const unsafeHTML = `<iframe src="https://example.com" width="100%" height="500"></iframe>`;

@Component({
  selector: 'app-root',
  template: ` <div [innerHTML]="snippet"></div> `,
})
export class AppComponent {
  constructor(private sanitizer: DomSanitizer) {}

  snippet = this.sanitizer.bypassSecurityTrustHtml(unsafeHTML);
}
```

`DomSanitizer.bypassSecurityTrustHtml` は引数に与えた文字列を `SafeHtml` 型としてラップし、サニタイズ処理をバイパスする。
もし`innerHTML` にバインディングされた `htmlSnippet` が単なる string であれば、
`<script>`タグや`<iframe>`タグのような XSS の危険性のあるタグはサニタイザーによって除去される。
一方、すでに安全であるとマークされた `SafeHtml`型であれば、Angular はその値を信じてサニタイズせずにそのまま挿入する。

当然だが、バイパスする場合 HTML の安全性、XSS の回避は完全に開発者の責任となることは留意しなくてはならない。
特に user-generated な文字列を挿入するケースでは、独自のサニタイズ処理を行うことは必須だろう。

<div class="flash">
  
`<script>`タグを含むHTMLをバイパスして `innerHTML` に挿入されても何も動作しないように見えるが、これはサニタイズされたのではなく `<script>` タグの[仕様](https://www.w3.org/TR/2014/REC-html5-20141028/scripting-1.html#the-script-element)である。
`<script>` タグのノード自体は作成されているが、実行はされない。動的な `<script>` タグの挿入は `document.createElement` などのAPIを使おう。

</div>

`innerHTML` へのテンプレートバインディングから実際に DOM に挿入されるまでの流れを簡単に模式化すると次のようになる。
処理の流れはバインディングされた HTML が string か `SafeHtml` かでサニタイズの有無が変わるが、
もし CSP で Trusted Types が要求されていれば、どちらにしてもブラウザからすれば信頼できない値としてエラーとなる。
つまり、これまで Angular アプリケーションでは Trusted Types を満足に利用することは難しかった。

![innerHTML binding and sanitization](/img/angular-trusted-types/2020-11-03T11-26-13.png)

### "angular" Trusted Types ポリシー

Angular に新しく実装される Trusted Types のサポートでは、上記のようなケースが CSP エラーとならないようにする。
Angular 側の課題はセキュリティ強度やサニタイズの中身ではなく、 **Angular 側ですでに信頼済みであることをブラウザに伝えられていない** ということであるため、
基本的なサニタイズの処理にはほとんど手は加わらない。

最終的な DOM 操作の前に、Angular は対象の文字列を Trusted HTML に変換するようになるが、このとき使用されるポリシーは、サニタイズがバイパスされているかどうかで変わる。
バイパスされず Angular が組み込みのサニタイザーを通した安全な文字列は `angular` ポリシーで Trusted HTML に変換される。
一方、Angular によるサニタイズをバイパスした場合は `angular#unsafe-bypass` ポリシーで変換される。

![innerHTML binding and sanitization with trusted types](/img/angular-trusted-types/2020-11-03T11-43-43.png)

現在の実装では名前以外にはポリシーの中身に違いはない。
これは Angular 標準のサニタイザーを通した操作とそうでない操作が依存するポリシーを分離し、`angular` ポリシーは Angular によって真に信頼されていることをソースコード上で明確にしているだけだ。
将来的には開発者が自分で Trusted Types ポリシーを設定できるカスタムサニタイザーを可能にする予定があり、そのための布石でもあるようだ。

つまり、今のところは開発者が Angular の Trusted Types サポートに関して何かを行う必要はないし、逆に何か介入することも難しい。
いままで存在した Angular 内部のセキュリティ機構がブラウザとも連携するようになったというだけの話である。

## まとめ

v11.0 の RC バージョンが開始してリリースが近づいてきたが、Trusted Types について理解しておきたいのは以下の点だ。

- Angular のテンプレートを介した DOM 操作が Trusted Types の仕様に準拠するようになる
- したがって、Angular のテンプレートバインディングを介した DOM 操作で Trusted Types 違反が起きなくなる
- HTML サニタイズの振る舞いや `DomSanitizer` の使い方はこれまでと変わらない
- ユーザー独自の Trusted Types ポリシーと連携する手段はまだ無い
- これまで同様、Angular が保護できるのはテンプレートを介したセキュリティだけであり、スクリプトによる DOM 操作はスコープ外である

Angular の Trusted Types サポートの動きを追跡したければ、GitHub のイシューを購読するとよい。

[\[tracking\] Support Trusted Types in Angular by bjarkler · Pull Request \#39222 · angular/angular](https://github.com/angular/angular/pull/39222)

[trusted types]: https://web.dev/trusted-types
[csp]: https://developer.mozilla.org/ja/docs/Web/HTTP/CSP

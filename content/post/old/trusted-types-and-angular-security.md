---
title: DOMのXSSを防ぐTrusted TypesとAngularのセキュリティ機構
date: 2019-05-13T00:16:00.000Z
tags: [angular, web, security, trusted-types, xss]
---

**Trusted Types** とは、現在 Chrome で実験的に実装され始めている新しいセキュリティポリシーの提案である。このポリシーにより、DOM 操作を経由した XSS から Web ページを保護できるようになる。仕様そのものやユースケースについては以下の記事がおすすめであるため、まずはじめに読んでほしい。

[安全な文字列であると型で検証する Trusted Types について | blog.jxck.io](https://blog.jxck.io/entries/2019-01-27/trusted-types.html)

[Trusted Types help prevent Cross-Site Scripting | Web | Google Developers](https://developers.google.com/web/updates/2019/02/trusted-types)

Trusted Types が新しい Web 標準として採用され、多くのブラウザで実装されるまでにはまだまだ時間がかかるだろうし、そもそも標準化されない可能性も当然ある。

標準化されるのは嬉しいが、それを待たずとも利用しているフレームワークがセキュリティ対策を行っているのであれば、今のところはそれらのベストプラクティスに従っておくのがいいだろう。

この記事では Angular の HTML テンプレートにおける組み込みの XSS 防止機能の紹介と、Trusted Types と比較した共通点、相違点を解説する。

## Angular の DOM-based XSS 対策

Angular はコンポーネントの定義の HTML テンプレートを使用し、HTML 要素のプロパティや属性、クラス、スタイルなどに動的なデータをバインディングできる。

DOM-based XSS のもっとも基本的な攻撃といえば、 `innerHTML` に代入される HTML 文字列に `<script>` タグを混入させ、任意の JavaScript を実行させるものだ。他にも `<img onerror="...">` や `<a href="javascript:...">` など、多くの場所で攻撃者が任意のコードを実行できる箇所がある。

Angular は、それらの攻撃が **データバインディングを介して** 行われることを禁止する。XSS への対策として、Angular はデフォルトですべての入力を **信頼できない値** として扱う。 プロパティ、属性、スタイル、クラスへのバインド、 `{{}}` による補間、これらを利用して DOM へ値を挿入する際、Angular は値の **サニタイズとエスケープ** を自動的に行う。

たとえば次のように、 動的な HTML 断片をテンプレートで挿入するケースを考える。

    @Component({
      template: `
    		<p>{{ htmlSnippet }}</p>
    		<p [innerHTML]="htmlSnippet"></p>
      `
    })
    class SomeComponent {
      htmlSnippet = `Template <script>alert("XSS")</script> <b>Syntax</b>`;
    }

まず 1 つ目の `<p>{{ htmlSnippet }}</p>` については、そもそも DOM として挿入されることはない。Angular の補間構文 `{{ data }}` は常に文字列を HTML エスケープするため、どのような文字列を渡してもコードが実行されることはない。

2 つ目の `<p [innerHTML]="htmlSnippet"></p>` は、 `<p>` タグの `innerHTML` プロパティにデータを渡す。これが Angular のテンプレートで動的な HTML 文字列を展開する唯一の方法である。ただし、 `innerHTML` プロパティへのバインディングは Angular により監視されていて、危険な文字列を検知するとその部分を除去、あるいは安全な文字列に置換する **サニタイズ処理** を自動的に行う。上記の例では、 `<script>` タグの部分だけが除去され、それ以外の部分はそのまま適用される。

![Untitled.png](/img/trusted-types-and-angular-security/Untitled.png)

他にも `<a [href]="...">` や `<img [src]="...">` など、XSS の危険性のあるプロパティへのデータバインディングはすべて Angular により検査されているため、**データバインディングによって DOM-based XSS が起こることは基本的にない**。

とはいえ、アプリケーションの要件によっては `<script>` タグを動的に挿入したいケースもあるし、常にサニタイズされてしまうのが困ることもある。そのようなときに使うのが Angular の`DomSanitizer` と `SecurityContext` である。これらは Trusted Types と非常によく似たアプローチを取っている。

### Angular に信頼できる値であることを伝える

先ほどの `<p [innerHTML]="htmlSnippet"></p>` で `<script>` タグを残すためには、開発者から Angular に対して `htmlSnippet` は信頼できるということを伝える必要がある。そのために使われるのが組み込み API の `DomSanitizer` だ。 `bypassSecurityTrustHtml` メソッドはその名の通り信頼できる HTML についてセキュリティ検査をバイパスする。HTML 文字列を渡し、その戻り値を `innerHTML` へバインディングすれば、任意の HTML を自由に挿入できる。

    import { DomSanitizer } from '@angular/platform-browser';

    @Component({
      template: `
    		<p>{{ htmlSnippet }}</p>
    		<p [innerHTML]="htmlSnippet"></p>
      `
    })
    class SomeComponent {
      constructor(private sanitizer: DomSanitizer) {}

      htmlSnippet = this.sanitizer.bypassSecurityTrustHtml(`Template <script>alert("XSS")</script> <b>Syntax</b>`);
    }

HTML 以外にも `bypassSecurityTrustURL` や `bypassSecurityTrustStyle` などが用意されている。詳しくは公式ドキュメンテーションを読んでほしい。

[Angular 日本語ドキュメンテーション](https://angular.jp/guide/security#bypass-security-apis)

### DomSanitizer は何をしているのか

`bypassSecurityTrustHtml` メソッドは次のようなシグネチャだ。文字列を受け取り、 `SafeHtml` 型のオブジェクトを返している。

    bypassSecurityTrustHtml(value: string): SafeHtml;

`innerHTML` プロパティへのデータバインディングの流れはこうだ。Angular はまず `innerHTML` プロパティへバインディングされた値の型をチェックする。値がもし文字列であれば未検査であるため、サニタイズする。一方、もし `SafeHtml` 型であれば、検査済みであるとしてそのまま扱う。

実は自動的に行われるサニタイズは `DomSanitizer.sanitize()` メソッドを呼び出している。そのため、テンプレート以外の場所で Angular と同じサニタイズをすることもできる。このとき、与えた文字列をサニタイズするうえで必要なのが **Security Context** である。

同じ文字列でも、HTML として見るか、URL として見るか、その文脈によって検査する内容が変わる。テンプレートではどのプロパティにバインディングしているかによって自動的に Security Context が設定されるが、テンプレート外では開発者が設定する必要がある。

    // HTML
    sanitizer.sanitize(SecurityContect.HTML, value)
    // URL (href)
    sanitizer.sanitize(SecurityContect.URL, value)
    // Resource URL (src)
    sanitizer.sanitize(SecurityContect.RESOURCE_URL, value)
    // Script (script src)
    sanitizer.sanitize(SecurityContect.SCRIPT, value)
    // Style
    sanitizer.sanitize(SecurityContect.STYLE, value)

## Trusted Types との比較

**Trusted Types** と Angular の Security Context はよく似ており、共に信頼できる値であることをオブジェクトの型で表現している。Trusted Types で現在定義されている型は次の 4 つである。

- TrustedHTML
- TrustedURL
- TrustedScriptURL
- TrustedScript

スタイルに関する型がない違いがあるが、CSS 中の `url(...)` のチェックは `TrustedURL` で行うのだろうか。だれか知っている人がいたら教えてほしい。

Trusted Types が提供するのは型と型を使ったセキュリティポリシーだけであり、エスケープやサニタイズをどのように行うかは開発者に責任がある。ここが Angular のセキュリティ機構との大きな違いである。Angular は Chrome のセキュリティチームと連携しており、Google の XSS 対策ベストプラクティスが Angular の DomSanitizer に詰まっているとも言える。

    // https://blog.jxck.io/entries/2019-01-27/trusted-types.html#trusted-types より
    const escapePolicy = TrustedTypes.createPolicy('application-policy', {
      createHTML: (unsafe) => {
        return unsafe
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")
      }
    })
    const trustedHTML = escapePolicy.createHTML('<img src=/ onerror="alert(10)">')

### Angular で防げない脆弱性

ここまで紹介した Angular のセキュリティ機能は、あくまでも **テンプレート内のデータバインディングを介した脆弱性** に限られたものである。コンポーネントのクラスメソッドの中で直接 DOM 操作することについてはフレームワークではどうしようもない部分だ。逆にいえば、このようなケースにおいてもセキュリティを守るための仕組みが Trusted Types である。

    @Component({...})
    class SomeComponent {

      insertHTML() {
        this.elementRef.nativeElement.innerHTML = `...` // チェックされない
      }
    }

### Trusted Types 標準化後の未来

Trusted Types がもし標準化されれば、Angular のサニタイズ処理は内部で Trusted Types を使い、 DomSanitizer は `TrustedHTML` 型のオブジェクトを返せるようになるかもしれない。

現在の時点でかなり親和性の高いモデルであるため、Angular 側の API は一切変わらず、内部だけで独自の型から Trusted Types への切り替えが行われる可能性もあるだろう。

エスケープやサニタイズといった Web ブラウザでは面倒を見ない部分こそが Angular のようなフレームワークに期待されることになり、Trusted Types のビルトインポリシーを提供するようなこともありえそうだ。

ともかく、どちらかがあればどちらかが要らない、というものではないことだ。

## まとめ

- Trusted Types という新しい Web 標準の仕様が提案されている
- Angular には組み込みの XSS 防止機構があり、Trusted Types と非常によく似ている
- Angular が防げるのはテンプレート内の脆弱性だけであり、DOM そのものの保護は Trusted Types が必要
- Trusted Types は既存の仕組みと競合するものではなく、フレームワークの内部で使われることも期待できる。

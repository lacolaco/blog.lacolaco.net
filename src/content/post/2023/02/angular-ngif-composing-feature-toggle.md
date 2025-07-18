---
title: 'Angular: NgIfを合成したフィーチャートグルディレクティブ'
slug: 'angular-ngif-composing-feature-toggle'
icon: ''
created_time: '2023-02-08T06:00:00.000Z'
last_edited_time: '2023-12-30T10:05:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'standalone component'
published: true
locale: 'ja'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-ngif-composing-feature-toggle'
notion_url: 'https://www.notion.so/Angular-NgIf-c30c4744b39047558495a126d32ad0d9'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angularの組み込みディレクティブ `NgIf` を使って、ある条件を満たすときにだけビューの一部分を描画するケースは多い。たとえば、特定の権限を持つユーザーにだけ表示されるビューを実装することがある。 `NgIf` を直接使う場合には、その条件ロジックをテンプレートあるいはコンポーネントで持つことになる。一箇所だけならよいが、同じようなロジックを多用するならそのロジックを含めて再利用可能にしたい。

今回はそのようなフィーチャートグルのユースケースをAngular v15で導入された `hostDirectives` 機能を使って実装してみよう。

サンプルはStackBlitzに用意した。以下、要点をかいつまんで解説するが、あくまでも概念実証的なサンプルコードなので**くれぐれもこのままプロダクションコードなどに転記しないように**。

https://stackblitz.com/edit/angular-ivy-nacplk?ctl=1&embed=1&file=src/app/app.component.html

次のコードで、`AuthDirective` に `NgIf` ディレクティブを合成している。合成とはどういうことか。そのディレクティブがテンプレートで使用されるとき、あたかも合成されたディレクティブも同じ位置に使用されているかのように振る舞う、ということである。

```ts
@Directive({
  selector: '[appIfHasPermissions]',
  standalone: true,
  hostDirectives: [NgIf],
})
export class AuthDirective implements OnInit, OnDestroy {
  private readonly ngIfDirective = inject(NgIf);
```

この場合、 `AuthDirective` が使用されるとき、ディレクティブが付与された要素に `NgIf` ディレクティブも同時に付与されているように振る舞う。そのため、 `AuthDirective` は同じ要素上に同居するディレクティブのインスタンスを `inject()` 関数によって（もちろんコンストラクタでもよい）参照できる。

あとは表示する条件を満たしたときに `NgIf` ディレクティブの `ngIf` プロパティが `true` になるようロジックを実装すればよい。

```ts
combineLatest([this.authService.user$, this._permissions]).subscribe(([user, requiredPermissions]) => {
  const permitted = requiredPermissions.every((p) => user.permissions.includes(p));
  this.ngIfDirective.ngIf = permitted;
});
```

このように `NgIf` と条件ロジックを合成したディレクティブを再利用可能にすることで、ディレクティブを使う側の責務は減ってコンポーネントが簡素になり、より宣言的なテンプレートに仕上がる。そしてDOM要素の生成・破棄のロジックはAngularの組み込みディレクティブに委譲しており、アプリケーションのユースケース的な関心だけを自前実装することができた。

```html
<div *appIfHasPermissions="[]">no permissions</div>
<div *appIfHasPermissions="['read-all']">read-all</div>
<div *appIfHasPermissions="['read-all', 'write-all']">read-all, write-all</div>
```

`NgIf` に限らず、Angularの組み込みディレクティブを `hostDirectives` を使って自作ディレクティブに合成して実装量を減らし、クオリティが保証されたDOM操作実装に乗っかることが簡単になった。つまり、**UIライブラリ的な関心事だけを実装したディレクティブ**と、**アプリケーション的な関心事をそれに上乗せするディレクティブ**とを分けて実装し、再利用やテストがしやすいモジュール化を実現しやすくなったということだ。ぜひさまざまな場面でこの新機能を活用してほしい。

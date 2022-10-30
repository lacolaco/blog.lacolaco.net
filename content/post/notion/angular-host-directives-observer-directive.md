---
title: 'Angular v15 hostDirectivesのユースケース検討: 状態監視系ディレクティブの合成'
date: '2022-10-30T09:53:00.000Z'
updated_at: '2022-10-30T13:42:00.000Z'
tags:
  - 'angular'
  - 'directive'
  - 'hostDirectives'
  - 'example'
  - 'IntersectionObserver'
draft: false
source: 'https://www.notion.so/Angular-v15-hostDirectives-8921bbca9dc243128119845110ae380e'
---

この記事では Angular v15 で追加される `@Directive.hostDirectives` の実用的なユースケースとして、状態監視系ディレクティブを合成する使い道を検討する。

`hostDirectives`は基本的にライブラリ製作者に向けた API である上に実装されてから日が浅いのでまだ詳しいドキュメントはないが、ひとまず一次情報としてはこの Issue が一番適しているだろう。

{{< embed "https://github.com/angular/angular/issues/8785" >}}

公式チャンネルではないが、Angular Components チームの [@crisbeto](https://github.com/crisbeto) が機能について詳しく語っている動画もあるので参考にしてほしい。

{{< youtube "oC9Qd9yw3pE" >}}

## ユースケース例: ViewportDirective の合成

`hostDirectives` はスタンドアロンなディレクティブを別のコンポーネントやディレクティブに合成できる機能であるから、合成されるディレクティブは再利用可能性が高いユーティリティ的なものが主になるだろう。

わざわざディレクティブとして実装して再利用したいユーティリティといえば、だいたいは `ElementRef` を参照して DOM を扱う類のものである。そこで今回は DOM の状態を監視する API のひとつである `IntersectionObserver` を利用して、画面内に要素が出入りするイベントをアプリケーションで扱えるようにする `ViewportDirective` を例に `hostDirectives` を試してみよう。

動作するサンプルは Stackblitz で公開している。

{{< stackblitz "https://stackblitz.com/edit/angular-ivy-utpuhe?ctl=1&embed=1&file=src/app/app.component.ts" >}}

### `ViewportDirective` の実装

本質的な部分ではないので詳細は省くが、 `IntersectionObserver` を使ってホスト要素が完全に表示されたときに `viewportIn` イベントを、ホスト要素が完全に画面外に隠れたときに `viewportOut` イベントを発火する。

```typescript
@Directive({
  selector: '[appViewport]',
  standalone: true,
})
export class ViewportDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef).nativeElement as HTMLElement;
  private intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        // 100%表示
        if (entry.isIntersecting && entry.intersectionRatio === 1) {
          this.viewportIn.emit();
        }
        // 100%非表示
        if (!entry.isIntersecting && entry.intersectionRatio === 0) {
          this.viewportOut.emit();
        }
      }
    },
    {
      threshold: [0, 1],
    },
  );

  @Output()
  readonly viewportIn = new EventEmitter<void>();
  @Output()
  readonly viewportOut = new EventEmitter<void>();

  ngAfterViewInit() {
    this.intersectionObserver.observe(this.el);
  }

  ngOnDestroy() {
    this.intersectionObserver.disconnect();
  }
}
```

### ディレクティブとして直接利用する

まずは `ViewportDirective` をそのままテンプレート中で直接呼び出して利用する。比較対象として書いているだけなので特に解説することはない。

```typescript
@Component({
  selector: 'my-app',
  standalone: true,
  imports: [ViewportDirective],
  template: `
    <div class="container">
      <div style="height: 110vh; background: tomato;">110vh</div>

      <div
        appViewport
        style="padding: 16px; border: 1px solid black;"
        (viewportIn)="onViewportIn('direct')"
        (viewportOut)="onViewportOut('direct')"
      >
        viewport directive (direct)
      </div>
    </div>
  `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  onViewportIn(name: string) {
    console.log(name, 'onViewportIn');
  }

  onViewportOut(name: string) {
    console.log(name, 'onViewportOut');
  }
}
```

### コンポーネントに合成して利用する (`hostDirectives` )

では、 `hostDirectives` を使ってコンポーネントに合成して `ViewportDirective` を使ってみよう。まずは合成する先のコンポーネントとして `BannerComponent` を定義する。

```typescript
@Component({
  selector: 'app-banner',
  standalone: true,
  template: ` <ng-content></ng-content> `,
})
export class BannerComponent {}
```

次に `hostDirectives` プロパティをコンポーネントメタデータに追加し、次のように `ViewportDirective` を追加する。 `hostDirectives` に追加するディレクティブは `imports` に追加する必要はない。（ `imports` はテンプレートコンパイルのためのメタデータであるから）

デフォルトではアウトプットは合成されないため、 `ViewportDirective` が持つ 2 つのアウトプットを `BannerComponent` の一部として公開するために、 `outputs` プロパティを設定している。

```typescript
@Component({
  ...,
  hostDirectives: [
    {
      directive: ViewportDirective,
      outputs: ['viewportIn', 'viewportOut'],
    },
  ],
})
```

これにより、 親コンポーネントでは `BannerComponent` には定義されていない `viewportIn` と `viewportOut` イベントにもアクセスできる。

```typescript
@Component({
  selector: 'my-app',
  standalone: true,
  imports: [ViewportDirective, BannerComponent],
  template: `
    <div class="container">
      <div style="height: 110vh; width: 100%; background: skyblue;">110vh</div>

      <app-banner
        (viewportIn)="onViewportIn('composite')"
        (viewportOut)="onViewportOut('composite')"
      >
        viewport directive (composite)
      </app-banner>
    </div>
  `,
  styleUrls: ['./app.component.css'],
})
export class AppComponent {}
```

### コンポーネント内部から参照する (dependency injection)

もうひとつの使い方として、 `hostDirectives` に追加したディレクティブの参照を Dependency Injection で取得することが考えられる。合成した機能を親コンポーネントに対して露出するのではなく、内部で利用する形だ。

次のように `inject` 関数で取得したホスト要素の `ViewportDirective` インスタンスを使い、 `viewportIn` と `viewportOut` のイベントを購読して処理を行うことができる。

```typescript
@Component({
  ...
  hostDirectives: [
    {
      directive: ViewportDirective,
    },
  ],
  host: {
    '[class.in-viewport]': 'isInViewport',
  },
})
export class BannerComponent {
  private viewport = inject(ViewportDirective, { self: true });
  isInViewport = false;

  ngOnInit() {
    merge(
      this.viewport.viewportIn.pipe(map(() => true)),
      this.viewport.viewportOut.pipe(map(() => false))
    ).subscribe((isInViewport) => {
      this.isInViewport = isInViewport;
    });
  }
}
```

## インプット・アウトプットの再公開は名前の設計が重要

今回の検討で感じたのは、 `outputs` を使ったケースでは `<app-banner>` コンポーネントが `viewportIn` / `viewportOut` を自身のアウトプットとして再公開したが、 `ViewportDirective` が公開するときに適した命名とは違っているように思う。

ディレクティブのインプット・アウトプットは、ディレクティブ名を prefix とするような命名がされやすい。たとえば `routerLink` に対して `routerLinkActive` のような感じだ。なぜかといえば同じホスト要素に複数の属性ディレクティブが付与されることがあり、名前空間を分けて衝突しないようにするからだ。

`BannerComponent` から再公開したインプット・アウトプットが合成されたものであったとしても、 `BannerComponent` を利用する側からすれば直接定義されたものとの間に違いはない。だから `BannerComponent` が持っていても不自然ではない名前で公開するようにエイリアスを設定するのがいいだろう。エイリアスは `元の名前: 再公開する名前` で設定できる。

```typescript
@Component({
  ...,
  hostDirectives: [
    {
      directive: ViewportDirective,
      outputs: [
        'viewportIn: shown', // `<app-banner (shown)="onBannerShown()">
      ],
    },
  ],
})
```

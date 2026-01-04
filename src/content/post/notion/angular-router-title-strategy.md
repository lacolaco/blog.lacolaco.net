---
title: 'Angular: Router に追加されるドキュメントタイトル更新機能について'
slug: 'angular-router-title-strategy'
icon: ''
created_time: '2022-01-29T00:00:00.000Z'
last_edited_time: '2023-12-30T10:06:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Angular-Router-af9e064dfecb4dd398dc268f54ef4089'
features:
  katex: false
  mermaid: false
  tweet: false
---

Angular Router に新しい機能が追加され、ルーティングによって URL を更新する際にドキュメントタイトル（`document.title`）を更新することができるようになる。 これまでは各アプリケーションが独自に実装しなければならなかったが、この一般的なユースケースが Router により標準サポートされることで開発者の負担が下がるだろう。

この機能は順当にいけば v14 のリリースに含められる見込みだ。

## 変更の概要

`Route` インターフェースに新しく `title` プロパティが追加される。たとえば、次のように`routes`配列を定義できるようになる。

```typescript
import { Route } from '@angular/router';

const routes: Route[] = [
  {
    path: 'foo',
    component: FooPageComponent,
    title: 'Foo Page',
  },
  {
    path: 'bar',
    component: BarPageComponent,
    title: 'Bar Page',
  },
];
```

このように `title` プロパティに設定された文字列は、その route へのナビゲーションが完了したときにドキュメントタイトルへ自動的に反映される。 `title` プロパティが設定されていない場合、またはナビゲーションが中断された場合には何も行われない。振る舞いとしては次のように書いた処理と実質的に同じである。

```typescript
router.events
  .filter((event) => event instanceof NavigationEnd)
  .subscribe(() => {
    const title = router.routerState.snapshot.data.title;
    if (title) {
      titleService.setTitle(title);
    }
  });
```

### Title Strategy

デフォルトでは `Route.title` プロパティに設定された文字列がそのままドキュメントタイトルに反映される。この振る舞いは `DefaultTitleStrategy` サービスの実装であり、ユーザー独自のストラテジーに差し替えることができる。

たとえば、ドキュメントタイトルに固定のプレフィックスを付与したい場合は次のようなストラテジーを適用できる。

```typescript
import { Title } from '@angular/platform-browser';
import { TitleStrategy, RouterStateSnapshot } from '@angular/router';

@Injectable()
export class AppTitleStrategy extends TitleStrategy {
  constructor(private titleService: Title) {}

  override updateTitle(snapshot: RouterStateSnapshot) {
    const title = this.buildTitle(snapshot);
    this.titleService.setTitle(title ? `My App | ${title}` : 'My App');
  }
}

@NgModule({
  imports: [
    RouterModule.forRoot({
      /* ... */
    }),
  ],
  providers: [{ provide: TitleService, useClass: AppTitleStrategy }],
})
export class AppRoutingModule {}
```

## 変更の経緯

今回の変更が加えられた PR

https://github.com/angular/angular/pull/43307

この PR でクローズされる Issue は 2016 年に出されたもの。Angular v2 時代から実に 6 年ごしでの解決となった。 ユーザー自身で多少のコードを書けば実現できることから低い優先度になっていたと思われるが、Ivy への移行が終わり、v14 に向けて機能拡張をおこなう余裕が出てきたのだろうか。 静的型チェックサポートを強化する Forms と同様に Router にも古くからの要望が山積みであるため、このような小さな改善は今後も期待したい。

https://github.com/angular/angular/issues/7630


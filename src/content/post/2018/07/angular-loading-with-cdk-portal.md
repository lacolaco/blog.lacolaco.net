---
title: 'Angular CDKのPortalを使ったローディングラッパーの実装'
slug: 'angular-loading-with-cdk-portal'
icon: ''
created_time: '2018-07-01T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Angular CDK'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-CDK-Portal-4218a5a9be5f46b9b852033819cb87da'
features:
  katex: false
  mermaid: false
  tweet: false
---

今回は Angular CDK(Component Dev Kit)の **Portal** 機能を使って、ローディングラッパーコンポーネントを実装する例の紹介です。 Angular の基本的な書き方はわかっている前提の内容になります。

---

ローディングラッパーとは次のようなテンプレートで、ローディング中はローディング表示を、ローディングが終わったら子要素を表示するようなコンポーネントを指しています。 たとえばこのようなテンプレートです。

```html
<mat-card>
  <loading-wrapper [loading]="isLoading$ | async">
    <div>Done!</div>
  </loading-wrapper>
</mat-card>
```

このように、ローディング状態によってビューが差し替わります。

![image](https://cdn-ak.f.st-hatena.com/images/fotolife/l/lacolaco/20180701/20180701162327.gif)

## CdkPortal の使い方

`@angular/cdk/portal`からインポートできる`PortalModule`によって、`cdkPortalOutlet`などのいくつかのディレクティブが有効になります。

```ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { PortalModule } from '@angular/cdk/portal';

import { AppComponent } from './app.component';
import { LoadingWrapperComponent } from './loading-wrapper.component';

@NgModule({
  imports: [BrowserModule, PortalModule],
  declarations: [AppComponent, LoadingWrapperComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

`cdkPortalOutlet`ディレクティブは、渡された`CdkPortal`に紐づくビューをその位置に表示します。

[https://material.angular.io/cdk/portal/api#CdkPortalOutlet](https://material.angular.io/cdk/portal/api#CdkPortalOutlet)

```html
<ng-template [cdkPortalOutlet]="contentPortal"></ng-template>
```

つまり、ローディングラッパーコンポーネントがおこなうことは、ローディング状態に応じて`contentPortal`の中身を差し替えることです。

## TemplatePortal の作成

`CdkPortal`はいくつかの種類がありますが、今回は`TemplateRef`をビューとして保持する`TemplatePortal`を使います。 ローディング状態のテンプレートを`loadingContent`、親コンポーネントから渡されるコンテンツ要素を`content`として、それぞれ`ViewChild`でコンポーネントから参照できるようにします。

```html
<ng-template #loadingContent>
  <div>
    <div>Loading...</div>
    <mat-spinner color="accent"></mat-spinner>
  </div>
</ng-template>

<ng-template #content>
  <ng-content></ng-content>
</ng-template>

<ng-template [cdkPortalOutlet]="contentPortal"></ng-template>
```

コンポーネント側では、初期化時と、ローディング状態を制御する`loading`プロパティが変わったときにビューをスイッチするようにします。 次のコードにおける`switchView`メソッドが、`TemplateOutlet`を作成している部分です。

```ts
@Component({
  selector: 'loading-wrapper',
  templateUrl: './loading-wrapper.component.html',
})
export class LoadingWrapperComponent implements OnInit, OnChanges {
  @Input() loading: boolean;

  @ViewChild('loadingContent') loadingContentTemplate: TemplateRef<any>;
  @ViewChild('content') contentTemplate: TemplateRef<any>;

  contentPortal: CdkPortal;

  constructor(private vcRef: ViewContainerRef) {}

  ngOnInit() {
    this.switchView();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.hasOwnProperty('loading')) {
      this.switchView();
    }
  }

  // 現在のローディング状態から適切なTemplatePortalを作成する
  switchView() {
    this.contentPortal = new TemplatePortal(this.getTemplate(), this.vcRef);
  }

  private getTemplate() {
    if (this.loading) {
      return this.loadingContentTemplate;
    }
    return this.contentTemplate;
  }
}
```

### まとめ

- `CdkPortal`を使って、状態に応じたビューの差し替えの実装が簡単にできる
- `TemplatePortal`を使って、`ng-template`から取り出した`TemplateRef`を`CdkPortal`に変換できる

完成形がこちらです。

https://stackblitz.com/edit/angular-ttuxpm

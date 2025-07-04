---
title: 'Angular 頻出実装パターン その1'
slug: 'angular-common-pattern-part-1'
icon: ''
created_time: '2018-04-10T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Angular-1-e3968f95daba42a888fff3cc92b3e661'
features:
  katex: false
  mermaid: false
  tweet: false
---

僕が Angular アプリケーションを書くときに頻出する実装パターンを紹介する記事です。続くかどうかは未定です。

## `onDestroy$`

`ngOnDestroy`メソッドが呼び出されたタイミングで emit される EventEmitter を作っておき、RxJS の`takeUntil`パイプなどで使う実装パターン。 `ngOnDestroy`メソッド内で`unsubscribe`メソッドを呼び出すよりも宣言的で意味が取りやすいし、忘れにくい。

実装例はこんな感じ。ReactiveFormsModule を使うときに`valueChanges`に引っ掛けることが多い。

```
import {
  Component,
  OnDestroy,
  OnInit,
  EventEmitter,
  Output
} from "@angular/core";
import { FormGroup, FormControl } from "@angular/forms";
import { takeUntil } from "rxjs/operators";

@Component({
  selector: "app-form",
  template: `
    <form [formGroup]="form">
      <input formControlName="name" />
    </form>
  `
})
export class FormComponent implements OnDestroy {
  @Output() valueChange = new EventEmitter<any>();

  readonly form = new FormGroup({
    name: new FormControl()
  });

  private readonly onDestroy$ = new EventEmitter();

  constructor() {
    this.form.valueChanges.pipe(takeUntil(this.onDestroy$)).subscribe(value => {
      this.valueChange.emit(value);
    });
  }

  ngOnInit() {
    this.form.patchValue({
      name: "Angular 5"
    });
  }

  ngOnDestroy() {
    this.onDestroy$.emit();
  }
}
```

[https://stackblitz.com/edit/angular-vdnrbp](https://stackblitz.com/edit/angular-vdnrbp)

## `MaterialModule`

Angular Material のモジュールを束ねるための中間モジュールを作るパターン。 使っているモジュールが一箇所でわかるのと、`TestBed`に依存モジュールとして渡すのが楽になるので有用。 DI 経由でグローバルに適用する Angular Material の設定もここにまとめられるのでわかりやすい。

```
import { NgModule } from "@angular/core";
import { MatButtonModule, MatCardModule } from "@angular/material";
import { PortalModule } from "@angular/cdk/portal";
import { OverlayModule } from "@angular/cdk/overlay";

export const modules = [
  MatButtonModule,
  MatCardModule,
  OverlayModule,
  PortalModule
];

@NgModule({
  imports: [...modules],
  exports: [...modules],
  providers: [
    {
      provide: MAT_LABEL_GLOBAL_OPTIONS,
      useValue: {
        float: "always"
      }
    }
  ]
})
export class MaterialModule {}
```

## `safeHtml`パイプ

これはみんな書くでしょ、って気がする。与えられた文字列を安全な HTML ですよ、とマーキングして Angular に渡すお仕事。

```
import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer } from "@angular/platform-browser";

@Pipe({
  name: "safeHtml"
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): any {
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
```

## `provideXXX`関数

サービスのプロバイダを関数としてエクスポートして、モジュール側で関数を呼び出すパターン。 何を provide しているかがわかりやすい。 複数のサービスを一気にプロバイドする場合、特に順序が重要になる`HTTP_INTERCEPTORS`のような`multi`なプロバイダにおいて、モジュール側にそれを意識させずに済むのが気に入ってる。

```
export function provideHttpInterceptor() {
  return [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthorizationHeaderInterceptor,
      multi: true
    },
    {
      provide: HTTP_INTERCEPTORS,
      useClass: CredentialInterceptor,
      multi: true
    }
  ];
}
```

```
import { provideHttpInterceptor } from './config/http';

@NgModule({
  ...
  providers: [
    provideHttpInterceptor(),
  ],
})
export class CoreModule {}
```

---

書いてみるとそれほど種類がないなという気がしてきたので、次回は未定です。

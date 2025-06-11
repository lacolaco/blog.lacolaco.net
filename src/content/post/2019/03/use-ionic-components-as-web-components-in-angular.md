---
title: 'Use Ionic components as Web Components in Angular'
slug: 'use-ionic-components-as-web-components-in-angular'
icon: ''
created_time: '2019-03-07T00:00:00.000Z'
last_edited_time: '2023-12-30T10:10:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Ionic'
published: true
locale: 'ja'
notion_url: 'https://www.notion.so/Use-Ionic-components-as-Web-Components-in-Angular-5abcd25b94664e91a124bb3a3026bc78'
features:
  katex: false
  mermaid: false
  tweet: false
---

![image](/images/use-ionic-components-as-web-components-in-angular/1__Y2FNLwDY1sJ39QlfpLqAaQ.png)

This article explains how to use Ionic components as standard Web Components. The Ionic team provides them as the first-class citizen, and it is quite easy to use.

### Ionic Core

Ionic has some _porting_ packages for specific frameworks; Angular, Vue and React. They are built on top of **Ionic Core,** which is a collection of Ionic components made as **Web Components**.

[https://github.com/ionic-team/ionic/blob/master/core/README.md](https://github.com/ionic-team/ionic/blob/master/core/README.md)

It is able to be used directly as a library. So we can use Ionic components everywhere if the platform supports the Web Components.

### Example: Angular App

I choose Angular as an example because Angular has great interop with Web Components.

At first, enable Custom Elements support of Angular templates. Without this, Angular emits errors on Custom Elements because they are unknown tags. Open `app.module.ts` and add `schemas` metadata as the following.

```
import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppComponent } from './app.component';

@NgModule({
  imports:      [ BrowserModule ],
  declarations: [ AppComponent ],
  bootstrap:    [ AppComponent  ],
  schemas:      [ CUSTOM\_ELEMENTS\_SCHEMA ]
})
export class AppModule { }
```

### Add CDN links in index.html

Ionic Core is available on unpkg CDN. Just add a script tag in index.html.

```html
<script src="https://unpkg.com/@ionic/core@4.1.0/dist/ionic.js"></script>
```

It is important that every Ionic component is loaded lazily and on-demand. It means you will pay network costs for components only which is used in HTML. It looks like magic. `dist/ionic.js` adds temporally elements. when it is used, it starts to load a real implementation. This is a feature from **[Stencil](https://stenciljs.com/)**.

In summary, you don’t have to worry about the payload size of unused components.

### Use component

In Ionic v4.1, `ion-skeleton-text` is available. It provides a view to display temporal loading state.

![image](/images/use-ionic-components-as-web-components-in-angular/0__v60Dp5pS0YJXAGDt.gif)

from [https://blog.ionicframework.com/ionic-release-4-1-hydrogen-out-now/](https://blog.ionicframework.com/ionic-release-4-1-hydrogen-out-now/)

Let’s use this in Angular with Observable data. Write `app.component.ts` like the below. When `loadText()` method is called, `text$` stream will updated with a new value after 1000ms.

```
import { Component } from "@angular/core";
import { BehaviorSubject } from "rxjs";

@Component({
  selector: "my-app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"]
})
export class AppComponent {
  text$ = new BehaviorSubject<string | null>("Initial Text");

  loadText() {
    this.text$.next(null);
    setTimeout(() => {
      this.text$.next(`Loaded Text: ${new Date()}`);
    }, 1000);
  }
}
```

Its template is here. It shows text only when the latest value of `text$` is not null.

```html
<button (click)="loadText()">Load Text</button
><ng-container *ngIf="text$ | async as text; else empty"> <div>{{ text }}</div></ng-container
><ng-template #empty> <ion-skeleton-text animated [style.width.px]="200"> </ion-skeleton-text></ng-template>
```

![image](/images/use-ionic-components-as-web-components-in-angular/1__XgAC86CfaTipJ9__37Jg5mg.gif)

Cool! Using Ionic components in Angular app is very easy. Also, you can see the running example at Stackblitz.

### Note: Ionic Angular

As you may already know, Ionic has Ionic Angular which is a library for Angular. It provides all Ionic components as Angular components. Angular components can expose its type information which is recognized by Angular template compilers.

If you want to use many Ionic components in Angular, or use in complex, it is better to use Ionic Angular instead of Ionic Core.

### Conclusion

- Ionic Core is a basic collection of Ionic components as Web Components.
- Ionic Core is available on CDN.
- Angular can integrate to Web Components in ease.

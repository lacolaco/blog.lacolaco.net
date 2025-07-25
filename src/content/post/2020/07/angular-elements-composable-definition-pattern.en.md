---
title: 'Angular Elements: Composable Definition Pattern'
slug: 'angular-elements-composable-definition-pattern.en'
icon: ''
created_time: '2020-07-22T00:00:00.000Z'
last_edited_time: '2023-12-30T10:09:00.000Z'
category: 'Tech'
tags:
  - 'Angular'
  - 'Angular Elements'
published: true
locale: 'en'
notion_url: 'https://www.notion.so/Angular-Elements-Composable-Definition-Pattern-eb942520a359470483d7c4ba864b7ce8'
features:
  katex: false
  mermaid: false
  tweet: false
---

Assuming a situation we have…

- An Angular component library project, `Lib1Module`
- An Angular Elements library project, `Lib1ElementsModule`
- An Angular Elements library project, `Lib2ElementsModule` which uses `Lib1ElementsModule`

It can be achieved with loading scripts of both Lib1 and Lib2 separately. But composing multiple Angular Elements definition brings some benefits.

- Unified Angular bootstrapping (better performance)
- Single `<script>` tag in HTML (free from loading order problem)

## Creating `Lib1ElementsModule`

```
import { createCustomElement } from '@angular/elements';

export function defineCustomElements(injector: Injector) {
  customElements.define(
    'lib1-button-element',
    createCustomElement(Lib1ButtonComponent, { injector })
  );
}

@NgModule({
  imports: [Lib1Module],
  // `entryComponents` is not needed if Ivy is enabled
  entryComponents: [Lib1ButtonComponent],
})
export class Lib1ElementsModule {
  constructor(private readonly injector: Injector) {}

  ngDoBootstrap() {
    defineCustomElements(this.injector);
  }
}
```

To use `Lib1ElementsModule` , bootstrap it directly. Then `ngDoBootstrap()` method will be called.

```
// main.elements.ts
platformBrowserDynamic().bootstrapModule(Lib1ElementsModule);
```

## Creating `Lib2ElementsModule`

`Lib2ElementsModule` enables both Lib1 and Lib2 Angular Elements by composition.

```
import { createCustomElement } from '@angular/elements';
import {
  Lib1ElementsModule,
  defineCustomElements as defineLib1Elements,
} from 'lib1';

export function defineCustomElements(injector: Injector) {
  customElements.define(
    'lib2-card-element',
    createCustomElement(Lib2CardComponent, { injector })
  );
}

@NgModule({
  imports: [Lib2Module, Lib1ElementsModule],
  // `entryComponents` is not needed if Ivy is enabled
  entryComponents: [Lib2CardComponent],
})
export class Lib2ElementsModule {
  constructor(private readonly injector: Injector) {}

  ngDoBootstrap() {
    // Compose definition
    defineLib1Elements(this.injector);
    defineCustomElements(this.injector);
  }
}
```

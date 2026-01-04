---
title: 'Access to global variables in Angular 2'
slug: 'access-to-global-variables-in-angular-2'
icon: ''
created_time: '2016-10-04T01:24:00.000Z'
last_edited_time: '2023-12-30T10:11:00.000Z'
tags:
  - 'Angular'
published: true
locale: 'ja'
category: 'Tech'
notion_url: 'https://www.notion.so/Access-to-global-variables-in-Angular-2-5fa5bd2c24b5494a984cd234f8fab462'
features:
  katex: false
  mermaid: false
  tweet: false
---

Don’t use `window` directly.

Angular 2 has an ability to develop an application in cross-platform because it doesn’t depend on DOM.
But it’s breakable easily. If you use `window`,`document` or anything browser-specific, then of course your app will lose the ability.

We often use `window` instance to get and set **global variables**. In browser platform, `window` is a single global context object.
In the other side, Node.js environment provides a global context as `global`.
To make our app platform-agnostic, we must **absorb** the difference.
Don’t worry. Already we have a powerful stuff for that.

**Dependency injection.**

## Define a global variable

Prepare a global variable `foo` as example.

```html
<body>
  <my-app>
    loading...
  </my-app>
  <script>
    window.DATA = {
      foo: "bar"
    };
  </script>
</body>

```

## Declare global type

First, we should declare our global type as an interface. In this case, global type has only `foo` string field.

```typescript
export interface MyGlobal {
  foo: string;
}

```

## Create `GlobalRef` class

This is a hero of this story. `GlobalRef` is an abstract class to access to the global object. It has only one `nativeGlobal` getter. (consistent with `ElementRef#nativeElement`.)

```typescript
export abstract class GlobalRef {
  abstract get nativeGlobal(): MyGlobal;
}

```

## Create platform-specific classes

`GlobalRef` class is just a placeholder. Let’s make platform-specific classes by extending `GlobalRef`.

```typescript
export class BrowserGlobalRef extends GlobalRef {
  get nativeGlobal(): MyGlobal {
    return window as MyGlobal;
  }
}
export class NodeGlobalRef extends GlobalRef {
  get nativeGlobal(): MyGlobal {
    return global as MyGlobal;
  }
}

```

## Provide `GlobalRef`

We must provide the classes. Let’ create `SharedModule` and define `SharedModule.forBrowser()` and `SharedModule.forNode()`.

```typescript
import { NgModule, ModuleWithProviders } from "@angular/core";
import { GlobalRef, BrowserGlobalRef, NodeGlobalRef } from "./global-ref";
@NgModule({})
export class SharedModule {
  static forBrowser(): ModuleWithProviders {
    return {
      ngModule: SharedModule,
      providers: [{ provide: GlobalRef, useClass: BrowserGlobalRef }]
    };
  }

  static forNode(): ModuleWithProviders {
    return {
      ngModule: SharedModule,
      providers: [{ provide: GlobalRef, useClass: NodeGlobalRef }]
    };
  }
}

```

And use them in `BrowserAppModule` and `NodeAppModule`.

```typescript
@NgModule({
  imports: [BrowserModule, SharedModule.forBrowser()],
  declarations: [App],
  bootstrap: [App]
})
export class BrowserAppModule {}
@NgModule({
  imports: [BrowserModule, SharedModule.forNode()],
  declarations: [App],
  bootstrap: [App]
})
export class NodeAppModule {}

```

## Bootstrap

Bootstrapping must be separated for each platform. Following is for only browser.

```typescript
import {platformBrowserDynamic} from '@angular/platform-browser-dynamic';
import {AppBrowserModule} from './app';
platformBrowserDynamic().bootstrapModule(AppBrowserModule)
Use `GlobalRef` in components
All done! Let’s use `GlobalRef` and access to global variables.
import {GlobalRef} from './global-ref';
@Component({
  selector: 'my-app',
  template: `
    <div>
      <pre>{{ data | json }}</pre>
    </div>
  `,
})
export class App {
  data: any;
  constructor(_global: GlobalRef) {
    this.data = _global.nativeGlobal.DATA;
  }
}

```

Plunker: [http://plnkr.co/edit/ceuEBlVpWhNNYZvMOqbO?p=preview](http://plnkr.co/edit/ceuEBlVpWhNNYZvMOqbO?p=preview)

## Conclusion

- Don’t access to `window` as global context
- Wrap the context and absorb the difference among platforms
- Use dependency injection and NgModule

Note: I never recommend you to use global variables. This is a small tip to tackle the real world… Good luck!


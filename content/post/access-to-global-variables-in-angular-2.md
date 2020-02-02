+++
title = "Access to global variables in Angular 2"
date = "2016-10-04T10:24:38+09:00"

+++

Don’t use `window` directly.

<!--more-->

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
      foo: 'bar'
    };
  </script>
</body>
```

## Declare global type
First, we should declare our global type as an interface. In this case, global type has only `foo` string field.

```ts
export interface MyGlobal {
  foo: string;
}
```

## Create `GlobalRef` class
This is a hero of this story. `GlobalRef` is an abstract class to access to the global object. It has only one `nativeGlobal` getter. (consistent with `ElementRef#nativeElement`.)

```ts
export abstract class GlobalRef { 
  abstract get nativeGlobal(): MyGlobal;
}
```

## Create platform-specific classes
`GlobalRef` class is just a placeholder. Let’s make platform-specific classes by extending `GlobalRef`.

```ts
export class BrowserGlobalRef extends GlobalRef {
  get nativeGlobal(): MyGlobal { return window as MyGlobal; }
}
export class NodeGlobalRef extends GlobalRef {
  get nativeGlobal(): MyGlobal { return global as MyGlobal; }
}
```

## Provide `GlobalRef`
We must provide the classes. Let’ create `SharedModule` and define `SharedModule.forBrowser()` and `SharedModule.forNode()`.

```ts
import { NgModule, ModuleWithProviders } from '@angular/core';
import { GlobalRef, BrowserGlobalRef, NodeGlobalRef } from './global-ref';
@NgModule({})
export class SharedModule {
  
  static forBrowser(): ModuleWithProviders {
    return {
      ngModule: SharedModule,
      providers: [
        { provide: GlobalRef, useClass: BrowserGlobalRef }
      ]
    };
  }
  
  static forNode(): ModuleWithProviders {
    return {
      ngModule: SharedModule,
      providers: [
        { provide: GlobalRef, useClass: NodeGlobalRef }
      ]
    };
  }
}
```

And use them in `BrowserAppModule` and `NodeAppModule`.

```ts
@NgModule({
  imports: [ BrowserModule, SharedModule.forBrowser() ],
  declarations: [ App ],
  bootstrap: [ App ]
})
export class BrowserAppModule {
}
@NgModule({
  imports: [ BrowserModule, SharedModule.forNode() ],
  declarations: [ App ],
  bootstrap: [ App ]
})
export class NodeAppModule {
}
```

## Bootstrap
Bootstrapping must be separated for each platform. Following is for only browser.

```ts
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

Plunker: http://plnkr.co/edit/ceuEBlVpWhNNYZvMOqbO?p=preview

## Conclusion
- Don’t access to `window` as global context
- Wrap the context and absorb the difference among platforms
- Use dependency injection and NgModule

Note: I never recommend you to use global variables. This is a small tip to tackle the real world… Good luck!
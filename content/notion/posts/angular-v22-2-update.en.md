---
title: 'Summary of Angular v22.2 Updates'
slug: 'angular-v22-2-update'
icon: ''
created_time: '2026-10-03T02:39:00.000Z'
last_edited_time: '2026-10-18T15:17:00.000Z'
tags:
  - 'Angular CLI'
  - 'Angular Material'
  - 'Signals'
  - 'Angular Update'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-v22-2-update'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-v22-2-3de3521b014a80f5991afe2520dc8cd1'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: '360d99fa833c1bc7ec5bdc27942d16bc4dec087947ac0af7e702400b6389575a'
---

Angular v22.2.0 has been released. Since it is a monthly minor update, various features have been added. Let's take a look at the details. I've narrowed it down to the important items, so if you want to know everything, I'd like you to check the official CHANGELOG.

## angular/angular

The main changes to the framework are as follows.

https://github.com/angular/angular/blob/main/CHANGELOG.md#2220

### Permission to access private members from templates

https://github.com/angular/angular/commit/48a0fd6e8a8d14bdc1d901ee5615f4b0ab698fe8

It is now possible to reference private members of a class from a component's template HTML. I have already written about the background and impact of this in a separate article, so I would like you to read that.

https://blog.lacolaco.net/posts/angular-private-fields

### Addition of `strictUnclaimedEventNames` 

https://github.com/angular/angular/commit/312e1d808902116fb8cd4e02d936260113453999

A compilation flag has been added that enforces that event bindings `(eventName)` in a template must match an event owned by the target DOM element or a directive's output. This is currently opt-in and is not included in `strictTemplates`, so it needs to be configured individually.

```html
<!-- error -->
<button (unknownEvent)="...">
```

### Addition of `@Component.deferredImports` 

https://github.com/angular/angular/commit/7d9f55da11319da8f273d9edcd38ff2983bdbb0c

For components, directives, and pipes linked to a specific named `@defer` block via `@Component.deferredImports`, template type checking now verifies that they are only used within that specified block. Using them outside of `@defer` or within a block with a different name will result in a compilation error.

```typescript
@Component({
  deferredImports: {
    blockA: [CmpA],
    blockB: [CmpB],
  },
  template: `
    @defer (name blockA) {
      <!-- error: CmpB (selector: 'cmp-b') is a dependency for blockB -->
      <cmp-b />
    }
  `,
})
export class App {}
```

### Addition of ErrorBoundary functionality

https://github.com/angular/angular/commit/f6afb807c1e62d26b8b665f2b4a9a52c2433a673

https://github.com/angular/angular/commit/f4a5650ed9c71a8ee1dbd3003e13900464827757

https://github.com/angular/angular/pull/70463

The `@boundary` block, which catches rendering errors within a template, has been added. If rendering fails within the block, it switches to the `@error` block, allowing errors in a part of the screen to be handled within that scope. In the `@error` block, you can reference the error with `$error` and use `$reset()` to clear the error state and attempt a re-render.

```html
@boundary {
  <complex-chart [data]="data" />
} @error {
  <p>チャートの描画に失敗した: {{ $error.message }}</p>
  <button (click)="$reset()">再試行</button>
}
```

An `onViewError` hook has also been added to `ErrorHandler`, making it possible to receive details about rendering errors. Along with this, the Angular Language Service now supports `@boundary` and `@error`, allowing the new syntax to be handled in autocomplete, hover, go-to-definition, block folding, and more.

https://blog.lacolaco.net/posts/angular-error-boundary

### Addition of test utilities for directives

https://github.com/angular/angular/commit/05c4d5a8354228100b51176f295ed5dee4f3febc

`TestBed.createDirective` has been added, making it possible to test directives without manually defining a host component for testing. From the returned `DirectiveFixture`, you can reference the directive instance itself via `directiveInstance`, the host element via `nativeElement`, and execute change detection with `detectChanges()`.

In `bindings`, you can specify `inputBinding` or `outputBinding`. Since the tag name of the host element cannot be inferred for directives with only attribute selectors, you should also specify a `tagName`.

```typescript
import { Directive, input, inputBinding, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

@Directive({
  selector: '[active]',
  host: { '[class.active]': 'active()' },
})
class ActiveDirective {
  active = input(false);
}

it('入力に応じてホスト要素のクラスを切り替える', () => {
  const active = signal(true);
  const fixture = TestBed.createDirective(ActiveDirective, {
    tagName: 'div',
    bindings: [inputBinding('active', active)],
  });
  fixture.detectChanges();
  expect(fixture.nativeElement.classList.contains('active')).toBe(true);

  active.set(false);
  fixture.detectChanges();
  expect(fixture.nativeElement.classList.contains('active')).toBe(false);
});
```

### Obtaining `Injector` in view and content queries

https://github.com/angular/angular/commit/bd9b45b5cc1dd904cc4a5de45f6de8e1564b70b6

It is now possible to specify `Injector` in the `read` option of view queries and content queries. What you obtain is the node injector of the element found by the query, allowing you to resolve providers visible from that element's position.

```typescript
import { Component, Directive, InjectionToken, Injector, viewChild } from '@angular/core';

const TOKEN = new InjectionToken<string>('TOKEN');

@Directive({
  selector: '[localProvider]',
  providers: [{ provide: TOKEN, useValue: '要素内の値' }],
})
class LocalProviderDirective {}

@Component({
  imports: [LocalProviderDirective],
  template: '<div #target localProvider></div>',
})
class AppComponent {
  targetInjector = viewChild.required('target', { read: Injector });

  ngAfterViewInit() {
    console.log(this.targetInjector().get(TOKEN)); // 'Value within the element'
  }
}
```

### Specifying permanently hidden fields in Signal Forms

https://github.com/angular/angular/commit/d5e8b1ef7a02c84d4fd70a6b4d748ead9ff815bf

In the `hidden` rule of Signal Forms, it's now possible to omit the condition. Previously, if you wanted a field to be always hidden, you had to specify `{ when: () => true }`, but now you can just write `hidden(path)`. The target field will always have `hidden()` return `true` and will also be excluded from validation.

```typescript
import { Component, signal } from '@angular/core';
import { form, FormField, hidden } from '@angular/forms/signals';

@Component({
  imports: [FormField],
  template: `
    @if (!profileForm.publicUrl().hidden()) {
      <input [formField]="profileForm.publicUrl" />
    }
  `,
})
class ProfileComponent {
  profileModel = signal({ publicUrl: '' });
  profileForm = form(this.profileModel, (path) => {
    hidden(path.publicUrl);
  });
}
```

`hidden` is a rule for specifying the state of a field in the form data and does not automatically hide the DOM. To toggle visibility, you reference `hidden()` on the template side as in the example above.

### Public release of the `containsTree` API

https://github.com/angular/angular/commit/2720362818cdeb2a940171e4ab6f21cf78c6a302

`containsTree`, which was used internally in the router, has become a public API of `@angular/router`. You can pass two `UrlTree` objects to determine if one is contained within the other. It can be used for comparing any arbitrary URLs, not just comparisons with the current URL.

```typescript
import { containsTree, DefaultUrlSerializer } from '@angular/router';

const serializer = new DefaultUrlSerializer();
const container = serializer.parse('/products/42?category=books&page=2');
const target = serializer.parse('/products?category=books');

containsTree(container, target);                     // true
containsTree(container, target, { paths: 'exact' });  // false
containsTree(container, target, { queryParams: 'exact' }); // false
```

### Redirecting by throwing `RedirectCommand`

https://github.com/angular/angular/commit/b65dea4f03e5fc01093a718c990c72ae9165c43f

It is now possible to redirect by throwing a `RedirectCommand` from guards or resolvers. `RedirectCommand` now inherits from `Error`, and the router treats the thrown command as a redirect rather than a typical navigation error.

Previously, you had to return the redirect instruction as a return value, but now you can interrupt processing with a `throw` even from nested helper functions. This eliminates the need to return and propagate the `RedirectCommand` back to the caller, and avoids having to mix redirect types into the helper's return type.

```typescript
import { inject } from '@angular/core';
import { RedirectCommand, ResolveFn, Router } from '@angular/router';

function requireId(id: string | null): string {
  if (id === null) {
    throw new RedirectCommand(inject(Router).parseUrl('/not-found'));
  }
  return id;
}

export const idResolver: ResolveFn<string> = (route) => {
  return requireId(route.paramMap.get('id'));
};
```

### Public release of the Router Resources API

https://github.com/angular/angular/commit/3064f3f1dccd78177bf3b86f8ea231102884f0d7

**Router Resources**, which handles per-route data fetching using the Resource API, is now a public API. It can be enabled with `withRouterResources()`, and data fetching logic can be defined in the route's `resources`. It supports parallel loading between routes, data fetching that doesn't block screen transitions, and re-fetching data without re-navigation.

https://blog.lacolaco.net/posts/angular-router-resources

### Stabilization of the per-route injector auto-cleanup feature

https://github.com/angular/angular/commit/7137a41223079b4b172aeccb5031347fcc947b79

The feature that automatically destroys injectors for routes that are no longer used has reached stable and is now available as `withAutoCleanupInjectors()`. The previous `withExperimentalAutoCleanupInjectors()` has been deprecated.

Normally, a route's injector and the services provided there are retained even if you navigate to another screen. When this feature is enabled, after navigation is complete, it checks the routes currently in use and those saved for reuse, and destroys any injectors that are no longer needed. Cleanup tasks registered in a service's `ngOnDestroy` or `DestroyRef` will also be executed.

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withAutoCleanupInjectors } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withAutoCleanupInjectors())],
};
```

### Support for native CSS nesting in encapsulation

https://github.com/angular/angular/commit/d0d7f57e0810a24ba16dbb1f2ab9f079a096fa3d

Native CSS nesting syntax is now handled correctly by `ViewEncapsulation.Emulated` style encapsulation. It now applies component scoping attributes to nested child selectors and can handle the `&` that references parent selectors.

```css
.card {
  .title {
    color: red;
  }

  &:hover {
    background: lightgray;
  }
}
```

### Binding functions and Signals to `animate.enter` and `animate.leave`

https://github.com/angular/angular/commit/de5889ec4fab2b337e394eb994c8d428272d5ec9

A bug where animations would not execute when a function or Signal returning a class name was passed directly to `[animate.enter]` or `[animate.leave]` has been fixed. Previously, you had to call it on the template side like `enterClass()`, but now you will be able to get the class name even if you pass a reference like `enterClass`.

```typescript
import { Component, signal } from '@angular/core';

@Component({
  template: `
    <button (click)="show.set(!show())">切り替え</button>
    @if (show()) {
      <div [animate.enter]="enterClass" [animate.leave]="leaveClass">
        Hello
      </div>
    }
  `,
})
class Example {
  show = signal(true);
  enterClass = signal('fade-in');
  leaveClass = () => 'fade-out';
}
```

## angular/angular-cli

The main changes to the Angular CLI are as follows.

https://github.com/angular/angular-cli/blob/main/CHANGELOG.md#2220

### Specifying the root directory for the MCP server

https://github.com/angular/angular-cli/commit/41555dfb3b71d08cdfe2853bf2cbeca5b6942f67

A `--root` option has been added to `ng mcp`. This allows you to explicitly specify the scope of file access for the MCP server and the starting point for searching the Angular workspace upon startup. Since multiple `--root` options can be specified, it can also be used when handling multiple workspaces or when starting the server from outside a workspace.

```bash
ng mcp --root /path/to/app-a --root /path/to/app-b
```

If the MCP client provides roots via `listRoots()`, those will take precedence. If the client does not support it or returns an empty list, the `--root` specification will be used; if neither is present, the current directory will be used.

### Narrowing the compilation scope to match test targets

https://github.com/angular/angular-cli/commit/f47f77f5f6db5cda1493652f813c98c26f172ea9

A bug in the Vitest execution of `@angular/build:unit-test` where tests would fail due to type errors in test files not specified by `--include` has been fixed. Previously, even if you narrowed down the tests to be executed, all test files included in the `tsconfig` were being compiled.

```bash
ng test --include='src/app/services/test.service.spec.ts'
```

### Migration to native implementation for file watching

https://github.com/angular/angular-cli/commit/a6ef9cfbeace725d58c0f7f65640ef6de9b39c33

File watching in `@angular/build` has been replaced from `watchpack` to an implementation centered on `@parcel/watcher`. By using the OS's file watching APIs through C++ native bindings, it reduces CPU and memory usage in watch mode. In environments where polling is used or native watching is unavailable, it falls back to `chokidar`.

### Migration to native implementation for the Sass compiler

https://github.com/angular/angular-cli/commit/ecbcd87b8857225e4df3df7896b3236d63553f23

Sass compilation in `@angular/build` has moved from a method that executes the JavaScript version of Dart Sass in worker threads to a method using `sass-embedded`. This starts the AOT-compiled Dart binary as a separate process and requests compilation asynchronously via standard input/output. The compiler process is reused across multiple compilations.

Benchmarks report the following improvements:

- In Sass processing alone, it's about 1.3 to 4.3 times faster in terms of median compilation time after compiler startup, and about 2 to 3 times faster for incremental compilation.
- For total real-time of `ng build`, it was shortened by about 8 to 14% for a small app with 5 Sass files. For a large app with 500 files, the first build was roughly equivalent, and subsequent builds were shortened by about 2 to 3%.
- Peak memory usage of `ng build` was **reduced by about 14 to 29% for small apps and about 31 to 33% for large apps**.

In the measurement examples, the effect of memory reduction was greater than the time reduction for large apps.

### Pre-compiling Critical CSS processing for SSR

https://github.com/angular/angular-cli/commit/23e3d44a7f051cd3bb67700b8d8407f73b7aa7f3

Style sheet analysis for Critical CSS inlining in `@angular/ssr` is now performed at build time. Critical CSS is a process that embeds the CSS necessary for rendering into the HTML so that it can be displayed without waiting for external style sheets to load. Previously, HTML and CSS were analyzed during request processing, but this has changed to a method where a "plan" for processing is generated from the CSS in advance and included in the server's manifest. This reduces the burden of analyzing CSS for every request, significantly reducing SSR CPU usage and the wait time for a response.

## angular/components

The main changes to Angular CDK, Aria, Material, etc., are as follows.

https://github.com/angular/components/blob/main/CHANGELOG.md#2220

### Auto-detection for Material Symbols

https://github.com/angular/components/commit/5d64e397b47e722e6ec8cd9eed69cd032766f656

`mat-icon` now detects the loaded Material Symbols font and automatically applies the corresponding CSS class. Previously, it applied the `material-icons` class for the old Material Icons by default, but if only Material Symbols are loaded, the appropriate `material-symbols-*` class (Outlined, Rounded, or Sharp) will be used.

```html
<!-- Load fonts in index.html -->
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" />

<!-- Specifying fontSet is unnecessary in the template -->
<mat-icon>home</mat-icon>
```

In the example above, the `material-symbols-outlined` class is automatically applied. This feature does not automatically load the font itself, so separate font loading is still necessary. If both the old Material Icons and Material Symbols are loaded, the traditional `material-icons` will take precedence for compatibility.

### `disabledInteractive` support for `MatMenuItem` 

https://github.com/angular/components/commit/cacab5551ba8a4af365b0e99132ef21e87c3b3f5

A `disabledInteractive` input has been added to `MatMenuItem`. When used in conjunction with `disabled`, it allows the item to accept focus and hover while maintaining a disabled appearance. Since it can be focused even when navigating items with the keyboard, it can be used for purposes such as explaining the reason for the inability to operate via a tooltip.

```html
<button [matMenuTriggerFor]="menu">操作</button>

<mat-menu #menu="matMenu">
  <button mat-menu-item disabled [disabledInteractive]="true"
          matTooltip="この操作には管理者権限が必要">
    削除
  </button>
</mat-menu>
```

Unlike standard `disabled`, the native `disabled` attribute is not applied, and the disabled state is communicated via `aria-disabled`.

### Angular Aria: Support for omitting `value` in `MenuItem` 

https://github.com/angular/components/commit/cd9c7da8b6caf503cf1c0b1de1e7e861077abefb

It is now possible to omit the `value` input in `MenuItem` for `@angular/aria/menu`. Previously, `value` was mandatory even when executing processing via an item's `(click)`, but now there's no need to add dummy values to menu items that don't use them. Even if multiple items omit the value, no warning about duplicate values will be issued.

```html
<div ngMenu>
  <button ngMenuItem (click)="newFile()">新規作成</button>
  <button ngMenuItem (click)="openFile()">開く</button>
</div>
```

### Signal Forms support for `MatFormFieldControl` 

https://github.com/angular/components/commit/42c72bf2ebb0a8ba0b38c5614814385b25df43e9

`MatFormFieldControl` can now handle custom controls using Signal Forms. When you expose the form field via the `ngField` property, `mat-form-field` reads states such as `valid` and `dirty` and reflects them in the corresponding CSS classes.

By adding `ngField` to the class provided as a `MatFormFieldControl`, you can integrate it with Signal Forms.

```typescript
import { Component, forwardRef, inject } from '@angular/core';
import { FORM_FIELD, FormField } from '@angular/forms/signals';
import { MatFormFieldControl } from '@angular/material/form-field';

@Component({
  selector: 'app-custom-name-input',
  templateUrl: './custom-input.html',
  providers: [{
    provide: MatFormFieldControl,
    useExisting: forwardRef(() => CustomNameInput),
  }],
})
export class CustomNameInput {
  // Integration part with Signal Forms
  readonly ngField: FormField<string> | null =
    inject(FORM_FIELD, {optional: true, self: true}) as FormField<string> | null;
}
```

On the side using the form, you pass the field with `[formField]` and place it within the `mat-form-field` as usual. The `inject(FORM_FIELD)` within the control retrieves this Signal Forms directive.

```html
<mat-form-field>
  <mat-label>名前</mat-label>
  <app-custom-name-input [formField]="profileForm.name" />
</mat-form-field>
```

Previously, the Angular Forms state was referenced through `ngControl`, but if `ngField` exists, it will take precedence to reference the Signal Forms state.
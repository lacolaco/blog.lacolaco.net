---
title: 'Summary of the Angular v22.2 Update'
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

Angular v22.2.0 has been released. As it is a monthly minor update, various features have been added. Let's go over the contents. I've narrowed it down to the important ones, so if you want to know everything, please refer to the official CHANGELOG.

## angular/angular

Main changes in the framework are as follows:

https://github.com/angular/angular/blob/main/CHANGELOG.md#2220

### Allowing Access to Private Members from Templates

https://github.com/angular/angular/commit/48a0fd6e8a8d14bdc1d901ee5615f4b0ab698fe8

You can now reference private members of a class from a component's template HTML. I have already written about the background and impact of this in another article, so I'd like you to read that.

https://blog.lacolaco.net/posts/angular-private-fields

### Addition of `strictUnclaimedEventNames`

https://github.com/angular/angular/commit/312e1d808902116fb8cd4e02d936260113453999

A compiler flag has been added that enforces that event bindings `(eventName)` in a template must match either an event held by the target DOM element or a directive's output. This is currently still opt-in and is not included in `strictTemplates`, so it needs to be configured individually.

```html
<!-- error -->
<button (unknownEvent)="...">
```

### Addition of `@Component.deferredImports`

https://github.com/angular/angular/commit/7d9f55da11319da8f273d9edcd38ff2983bdbb0c

For components, directives, and pipes linked to a specific named `@defer` block via `@Component.deferredImports`, template type checking now verifies that they are only used within the specified block. Using them outside of `@defer` or in a block with a different name will result in a compilation error.

```typescript
@Component({
  deferredImports: {
    blockA: [CmpA],
    blockB: [CmpB],
  },
  template: `
    @defer (name blockA) {
      <!-- error: CmpB（selector: 'cmp-b'）はblockB用の依存 -->
      <cmp-b />
    }
  `,
})
export class App {}
```

### Addition of ErrorBoundary Feature

https://github.com/angular/angular/commit/f6afb807c1e62d26b8b665f2b4a9a52c2433a673

https://github.com/angular/angular/commit/f4a5650ed9c71a8ee1dbd3003e13900464827757

https://github.com/angular/angular/pull/70463

An `@boundary` block has been added to capture rendering errors within templates. If rendering within the block fails, it switches to the `@error` block, allowing errors in one part of the screen to be handled within that scope. In `@error`, you can reference the error with `$error` and attempt to re-render by clearing the error state with `$reset()`.

```html
@boundary {
  <complex-chart [data]="data" />
} @error {
  <p>チャートの描画に失敗した: {{ $error.message }}</p>
  <button (click)="$reset()">再試行</button>
}
```

An `onViewError` hook has also been added to `ErrorHandler`, allowing it to receive details of rendering errors. Additionally, the Angular Language Service now supports `@boundary` and `@error`, enabling the new syntax to be handled with autocomplete, hover, go-to-definition, block folding, and more.

https://blog.lacolaco.net/posts/angular-error-boundary

### Addition of Test Utilities for Directives

https://github.com/angular/angular/commit/05c4d5a8354228100b51176f295ed5dee4f3febc

`TestBed.createDirective` has been added, making it possible to test directives without having to define a host component for testing yourself. From the returned `DirectiveFixture`, you can reference the directive itself via `directiveInstance` and the host element via `nativeElement`, and perform change detection with `detectChanges()`.

You can specify `inputBinding` or `outputBinding` for `bindings`. Since the tag name of the host element cannot be inferred for directives that only have an attribute selector, you also specify `tagName`.

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

### Retrieving `Injector` in View/Content Queries

https://github.com/angular/angular/commit/bd9b45b5cc1dd904cc4a5de45f6de8e1564b70b6

It is now possible to specify `Injector` in the `read` option of view and content queries. What you get is the node injector of the element found by the query, which allows you to resolve providers visible from that element's position.

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

### Specifying Permanently Hidden Fields in Signal Forms

https://github.com/angular/angular/commit/d5e8b1ef7a02c84d4fd70a6b4d748ead9ff815bf

In Signal Forms' `hidden` rules, it is now possible to omit the condition. Previously, even if you wanted a field to be always hidden, you had to specify `{ when: () => true }`, but now you can write it just as `hidden(path)`. The target field's `hidden()` will always be `true`, and it will also be excluded from validation.

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

`hidden` is a rule for specifying the state of a field in the form data, and it does not automatically hide the DOM. To toggle visibility, you reference `hidden()` on the template side, as shown in the example above.

### Exposing the `containsTree` API

https://github.com/angular/angular/commit/2720362818cdeb2a940171e4ab6f21cf78c6a302

`containsTree`, which was used internally by the router, has become a public API of `@angular/router`. You can pass two `UrlTree` objects and determine if one is contained within the other. This can be used for purposes such as comparing arbitrary URLs, not just comparisons with the current URL.

```typescript
import { containsTree, DefaultUrlSerializer } from '@angular/router';

const serializer = new DefaultUrlSerializer();
const container = serializer.parse('/products/42?category=books&page=2');
const target = serializer.parse('/products?category=books');

containsTree(container, target);                     // true
containsTree(container, target, { paths: 'exact' });  // false
containsTree(container, target, { queryParams: 'exact' }); // false
```

### Redirecting by Throwing `RedirectCommand`

https://github.com/angular/angular/commit/b65dea4f03e5fc01093a718c990c72ae9165c43f

It is now possible to redirect by throwing a `RedirectCommand` from guards or resolvers. `RedirectCommand` now inherits from `Error`, and the router treats the thrown command as a redirect rather than a normal navigation error.

Previously, it was necessary to return the redirect instruction as a return value, but now you can also interrupt processing from nested helper functions by using `throw`. This eliminates the need to propagate the `RedirectCommand` by returning it up to the caller, and avoids mixing redirect types into the return type of the helper.

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

### Exposing the Router Resources API

https://github.com/angular/angular/commit/3064f3f1dccd78177bf3b86f8ea231102884f0d7

**Router Resources**, which handles per-route data fetching via the Resource API, has become a public API. You enable it with `withRouterResources()` and can define data fetching logic in the route's `resources`. It supports parallel loading between routes, data fetching that doesn't block screen transitions, and re-fetching data without re-navigation.

https://blog.lacolaco.net/posts/angular-router-resources

### Stabilization of Per-Route Injector Auto-Cleanup

https://github.com/angular/angular/commit/7137a41223079b4b172aeccb5031347fcc947b79

The feature to automatically destroy injectors for unused routes has become stable and is now available as `withAutoCleanupInjectors()`. The previous `withExperimentalAutoCleanupInjectors()` has been deprecated.

Normally, route injectors and the services provided there are retained even after navigating to another screen. When this feature is enabled, it checks the routes in use and the routes saved for reuse after navigation is complete, and destroys injectors that are no longer needed. Post-processing registered in the service's `ngOnDestroy` or `DestroyRef` is also executed.

```typescript
import { ApplicationConfig } from '@angular/core';
import { provideRouter, withAutoCleanupInjectors } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [provideRouter(routes, withAutoCleanupInjectors())],
};
```

### Encapsulation Support for CSS Native Nesting Syntax

https://github.com/angular/angular/commit/d0d7f57e0810a24ba16dbb1f2ab9f079a096fa3d

CSS native nesting syntax is now handled correctly by the style encapsulation of `ViewEncapsulation.Emulated`. Component scoping attributes are now attached to nested child selectors as well, and the `&` that references the parent selector can also be handled.

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

### Binding Functions and Signals to `animate.enter` and `animate.leave`

https://github.com/angular/angular/commit/de5889ec4fab2b337e394eb994c8d428272d5ec9

A bug has been fixed where animations would not run if a function or Signal returning a class name was passed directly to `[animate.enter]` or `[animate.leave]`. Previously, it was necessary to call them on the template side like `enterClass()`, but now you can get the class name even by passing a reference like `enterClass`.

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

Main changes in Angular CLI are as follows:

https://github.com/angular/angular-cli/blob/main/CHANGELOG.md#2220

### Specifying the Root Directory for the MCP Server

https://github.com/angular/angular-cli/commit/41555dfb3b71d08cdfe2853bf2cbeca5b6942f67

A `--root` option has been added to `ng mcp`. You can explicitly specify the range within which the MCP server allows file access and the starting point for exploring the Angular workspace at startup. Since `--root` can be specified multiple times, it can also be used when handling multiple workspaces or when starting the server from outside a workspace.

```bash
ng mcp --root /path/to/app-a --root /path/to/app-b
```

If the MCP client provides roots via `listRoots()`, those take precedence. If the client does not support it or returns an empty list, the `--root` specification is used; if neither is present, the current directory is used.

### Narrowing Compilation Scope to Match Test Targets

https://github.com/angular/angular-cli/commit/f47f77f5f6db5cda1493652f813c98c26f172ea9

A bug has been fixed in the Vitest execution of `@angular/build:unit-test` where tests would fail due to type errors in test files not specified by `--include`. Previously, even if you narrowed down the tests to be executed, all test files included in `tsconfig` were compiled.

```bash
ng test --include='src/app/services/test.service.spec.ts'
```

### Migration to Native Implementation for File Watching

https://github.com/angular/angular-cli/commit/a6ef9cfbeace725d58c0f7f65640ef6de9b39c33

File watching in `@angular/build` has been replaced with an implementation centered on `@parcel/watcher` instead of `watchpack`. It uses the OS file watching API through C++ native bindings to reduce CPU and memory usage in watch mode. In environments where polling is used or native watching is unavailable, it falls back to `chokidar`.

### Migration to Native Implementation for the Sass Compiler

https://github.com/angular/angular-cli/commit/ecbcd87b8857225e4df3df7896b3236d63553f23

Sass compilation in `@angular/build` has migrated from running the JavaScript version of Dart Sass in worker threads to a method using `sass-embedded`. It starts the Dart AOT-compiled binary as a separate process and requests compilation asynchronously via standard input/output. The compiler process is reused across multiple compilations.

Benchmarks report the following improvements:

- In Sass processing alone, a speedup of approximately 1.3–4.3x for the median compilation time after compiler startup, and approximately 2–3x for incremental compilation.
- For overall `ng build` real time, a reduction of approximately 8–14% for a small app with 5 Sass files. For a large app with 500 files, the first build is roughly equivalent, but subsequent builds are approximately 2–3% faster.
- Peak memory usage for `ng build` was **reduced by approximately 14–29% for small apps and by approximately 31–33% for large apps**.

In the measurement examples, the large app showed a greater effect in memory reduction than in time reduction.

### Pre-compilation of Critical CSS Processing for SSR

https://github.com/angular/angular-cli/commit/23e3d44a7f051cd3bb67700b8d8407f73b7aa7f3

In `@angular/ssr`'s Critical CSS inlining, stylesheet analysis is now performed at build time. Critical CSS is a process that embeds the CSS necessary for rendering into the HTML so that it can be displayed without waiting for external stylesheets to load. Previously, HTML and CSS were analyzed during request processing, but this has changed to a method where a "plan" for processing is pre-generated from the CSS and included in the server manifest. This reduces the burden of analyzing CSS for each request, significantly reducing SSR CPU usage and response latency.

## angular/components

Main changes in Angular CDK, Aria, Material, etc. are as follows:

https://github.com/angular/components/blob/main/CHANGELOG.md#2220

### Automatic Detection of Material Symbols

https://github.com/angular/components/commit/5d64e397b47e722e6ec8cd9eed69cd032766f656

`mat-icon` now identifies the loaded Material Symbols font and automatically adds the corresponding CSS class. Previously, the `material-icons` class for the old Material Icons was added by default, but if only Material Symbols are loaded, `material-symbols-*` classes corresponding to Outlined, Rounded, or Sharp will be used.

```html
<!-- Load the font in index.html -->
<link rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" />

<!-- fontSet specification is not required in the template -->
<mat-icon>home</mat-icon>
```

In the above example, the `material-symbols-outlined` class is automatically applied. This feature doesn't automatically load the font itself, so separate font loading is still required. If both old Material Icons and Material Symbols are loaded, the traditional `material-icons` takes precedence for compatibility.

### `MatMenuItem` Support for `disabledInteractive` 

https://github.com/angular/components/commit/cacab5551ba8a4af365b0e99132ef21e87c3b3f5

A `disabledInteractive` input has been added to `MatMenuItem`. When used with `disabled`, it allows the item to accept focus and hover while maintaining a disabled appearance. Since it can be focused when navigating through items with the keyboard, it can be used for purposes such as explaining the reason it can't be operated via a tooltip.

```html
<button [matMenuTriggerFor]="menu">操作</button>

<mat-menu #menu="matMenu">
  <button mat-menu-item disabled [disabledInteractive]="true"
          matTooltip="この操作には管理者権限が必要">
    削除
  </button>
</mat-menu>
```

Unlike normal `disabled`, the native `disabled` attribute is not added, and the disabled state is conveyed via `aria-disabled`.

### Angular Aria: Support for Omitting `value` in `MenuItem`

https://github.com/angular/components/commit/cd9c7da8b6caf503cf1c0b1de1e7e861077abefb

In `MenuItem` from `@angular/aria/menu`, the `value` input can now be omitted. Previously, `value` was required even when executing processing via `(click)` on each item, but now you don't need to add dummy values to menu items that don't use a value. Even if there are multiple items with omitted values, no warning about duplicate values will be issued.

```html
<div ngMenu>
  <button ngMenuItem (click)="newFile()">新規作成</button>
  <button ngMenuItem (click)="openFile()">開く</button>
</div>
```

### `MatFormFieldControl` Support for Signal Forms

https://github.com/angular/components/commit/42c72bf2ebb0a8ba0b38c5614814385b25df43e9

`MatFormFieldControl` can now handle custom controls that use Signal Forms. By exposing a form field via the `ngField` property, `mat-form-field` can read states such as `valid` and `dirty` and reflect them in the corresponding CSS classes.

Signal Forms integration is possible by adding `ngField` to the class provided as `MatFormFieldControl`.

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

The side using the form passes the field via `[formField]` as usual and places it within the `mat-form-field`. The `inject(FORM_FIELD)` within the control retrieves this Signal Forms directive.

```html
<mat-form-field>
  <mat-label>名前</mat-label>
  <app-custom-name-input [formField]="profileForm.name" />
</mat-form-field>
```

Previously, the state of Angular Forms was referenced through `ngControl`, but if `ngField` exists, it takes precedence and references the state of Signal Forms.
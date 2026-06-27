---
title: 'Angular v22: Lazy loading business logic with injectAsync'
slug: 'angular-v22-injectasync'
icon: ''
created_time: '2026-06-21T23:49:00.000Z'
last_edited_time: '2026-06-22T00:00:00.000Z'
tags:
  - 'TypeScript'
  - 'Dependency Injection'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-v22-injectasync'
channels:
  - 'Angular'
notion_url: 'https://app.notion.com/p/Angular-v22-injectAsync-3813521b014a80c7aad1d3778117c09c'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'b90f88266398885cf2ef78a2a4e0bcb7bbde2ce5661b42ea2abcd8c0621178b3'
---

The `injectAsync` function added in Angular v22 provides a new option for improving loading speeds. I'll take a look at the existing lazy loading APIs while introducing this new one.

https://angular.jp/guide/di/lazy-loading-services

## `injectAsync` 

The `inject` function used for dependency injection creates a static reference to the target being injected. Therefore, if the depending side is included in the initial load JS, the side being depended upon will similarly increase the bundle size. In the following example, the `ReportView` component and the `ReportExporter` service are statically coupled, and their loading timing cannot be separated.

```typescript
// Static import
import { ReportExporter } from './exporter';

@Component({...})
export class ReportView {
  // ReportView statically references ReportExporter
  exporter = inject(ReportExporter);
  
  export() {
    this.exporter.export();
  }
}
```

If `ReportExporter` isn't a feature that's always used, I might want to keep only `ReportView` in the initial load and delay `ReportExporter` so it's only loaded when the export button is pressed. `injectAsync` is what makes this possible. This function asynchronizes the injection of specific services, allowing bundles to be split and modules to be lazy-loaded.

As shown in the following example, we replace the reference to the `ReportExporter` service from a static import to a dynamic import in the argument of the `injectAsync` function. By doing this, the `this.exporter` field becomes a function that, when called, asynchronously returns the service reference. If you `await` the return value, you can use the service just as before.

```typescript
@Component({...})
export class ReportView {
  // Dynamic import
  // ReportView dynamically references ReportExporter
  exporter = injectAsync(() => import('./exporter').then(m => m.ReportExporter));
  
  async export() {
    const exporter = await this.exporter();
    exporter.export();
  }
}
```

### Usage Constraints

`injectAsync` can only be used with services declared with `@Injectable({ providedIn: 'root' })` or the `@Service()` decorator. Because it is dynamically integrated into the dependency injection system according to the module loading, it doesn't support complex provider definitions.

## Lazy Loading Methods and Use Cases

As in the example above, if a portion of the features provided by the application is infrequently used, it's worth considering lazy loading to avoid compromising the experience for users who don't use those features. Angular provides several lazy loading APIs, but which one to use depends on the application domain—specifically, at what granularity and at which boundaries the application's features can be divided.

### Route-based Lazy Loading

The largest granularity for lazy loading is the method of splitting bundles by the Router's page loading unit (route). You can use `loadChildren` when you want to lazy load all pages under a certain path using route parent-child relationships, or `loadComponent` when you want to lazy load a specific route.

```typescript
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    // Lazy load the login page
    loadComponent: () => import('./components/auth/login-page'),
  },
  {
    path: 'admin',
    // Lazy load the admin pages
    loadComponent: () => import('./admin/admin.component'),
    loadChildren: () => import('./admin/admin.routes'),
  },
];
```

In cases where accessible pages are clearly divided, such as by user permissions, introducing route-based lazy loading would likely be effective.

https://angular.jp/best-practices/performance/lazy-loaded-routes

### Partial View Lazy Loading

Using a `@defer` block, you can make portions of a component view lazy-loadable. The view is loaded and initialized only when that area enters the screen or when a user performs an action.

```typescript
@defer {
  <large-component />
} @placeholder {
  <p>プレースホルダーコンテンツ</p>
}
```

This is an option when a specific component among a component's descendant views has a large impact on bundle size, and its display speed isn't mission-critical. Examples might include calendar widgets or complex forms. Comment sections for blog posts that aren't in the initial viewport would also be prime candidates. In cases where the frequency and timing of feature use differ depending on the screen area, lazy loading views with `@defer` would likely work effectively.

https://angular.jp/best-practices/performance/defer

### Service Lazy Loading

When it's not the view but the logic that has parts capable of being deferred, `injectAsync` is the choice I introduced here. If logic that uses a large third-party library isn't needed for the initial load and its loading can be triggered only when necessary, then it's time for `injectAsync`.

https://angular.jp/best-practices/performance/lazy-loading-services

### Module Lazy Loading

Finally, it's a method often forgotten because it's not an Angular API, but you can achieve module-level lazy loading simply by using the ES Module dynamic import `import(...)`. This is because dynamic imports are converted into lazy loading within the Angular CLI build process. If the target to be loaded is just a function, class, or constant and isn't related to Angular's dependency injection or component system, using a plain dynamic import is sufficient.

For libraries used only in specific use cases, you could split them by the service that uses them, or you could reference the service statically and split it at the module level internally. You can decide this based on implementation preference. The only difference is whether the responsibility for asynchronous processing lies outside or inside the service. Personally, I think if `injectAsync` covers it, that's fine, but when complex DI provider definitions are required, it might be a good idea to combine it with module-level lazy loading as appropriate.

## Summary

- `injectAsync` enables bundle splitting and lazy loading on a per-service basis by replacing DI references with dynamic imports.
- It is limited to services declared with `@Injectable({ providedIn: 'root' })` or `@Service()`, and does not support complex provider definitions.
- Lazy loading methods and split units provided by Angular:
  - Routes: `loadChildren` / `loadComponent`
  - Partial views: `@defer`
  - Services: `injectAsync`
  - Other modules: `import(...)`
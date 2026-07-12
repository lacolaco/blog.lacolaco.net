---
title: 'Angular v22: Lazy Loading Business Logic with injectAsync'
slug: 'angular-v22-injectasync'
icon: ''
created_time: '2026-06-21T23:49:00.000Z'
last_edited_time: '2026-07-12T00:37:00.000Z'
tags:
  - 'TypeScript'
  - 'Dependency Injection'
published: true
locale: 'en'
canonical_url: 'https://zenn.dev/lacolaco/articles/angular-v22-injectasync'
channels:
  - 'Angular'
  - 'Code'
notion_url: 'https://app.notion.com/p/Angular-v22-injectAsync-3813521b014a80c7aad1d3778117c09c'
features:
  katex: false
  mermaid: false
  tweet: false
auto_translated_from: 'b90f88266398885cf2ef78a2a4e0bcb7bbde2ce5661b42ea2abcd8c0621178b3'
---

The `injectAsync` function added in Angular v22 provides a new option for improving loading speeds. I'll introduce this new API while reviewing the lazy loading APIs that have existed until now.

https://angular.jp/guide/di/lazy-loading-services

## `injectAsync` 

The `inject` function used for dependency injection creates a static reference to the target being injected. Therefore, if the dependent side is included in the initial load JS, the side being depended upon will also increase the bundle size. In the following example, the `ReportView` component and the `ReportExporter` service are statically coupled, and their loading timing cannot be separated.

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

If `ReportExporter` is not a feature that is always used, we might want to keep only `ReportView` in the initial load and delay `ReportExporter` so it's only loaded when the export button is pressed. That's what `injectAsync` achieves. This function asynchronizes the injection of a specific service, allowing for bundle splitting and making the module lazy-loadable.

Following the example below, replace the reference to the `ReportExporter` service from a static import to a dynamic import in the argument of the `injectAsync` function. By doing this, the `this.exporter` field becomes a function that returns a reference to the service asynchronously when called. By `await`-ing the return value, you can use the service just as before.

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

Only services declared with `@Injectable({ providedIn: 'root' })` or the `@Service()` decorator can use `injectAsync`. Because they are integrated into the dependency injection system dynamically as modules are loaded, complex provider definitions are not supported.

## Lazy Loading Methods and Use Cases

As in the example above, if a portion of the features provided by an application is infrequently used, it's worth considering lazy loading to avoid compromising the experience for users who don't use those features. Angular provides several lazy loading APIs, but how to choose between them depends on the application domain—specifically, what granularity and at what boundaries the application's features can be divided.

### Lazy Loading via Routes

The largest granularity for lazy loading is splitting bundles by the Router's page loading unit (route). When you want to lazy load pages under a certain path together using parent-child route relationships, you can use `loadChildren`; when you want to lazy load a specific route, you can use `loadComponent`.

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

In cases where accessible pages are clearly separated, such as by user permissions, introducing route-based lazy loading would likely be effective.

https://angular.jp/best-practices/performance/lazy-loaded-routes

### Lazy Loading Partial Views

Using the `@defer` block, parts of a component view can be made lazy-loadable. The view is loaded and initialized only when that area enters the viewport or when the user performs an action.

```typescript
@defer {
  <large-component />
} @placeholder {
  <p>プレースホルダーコンテンツ</p>
}
```

This is an option when a specific component within a descendant view has a large impact on bundle size, and its display speed is not mission-critical. For example, calendar widgets or complex forms come to mind. The comment section of a blog post that isn't part of the initial view would also be a prime candidate for this.

In cases where the frequency and timing of feature use vary depending on the screen area, lazy loading views with `@defer` would work effectively.

https://angular.jp/best-practices/performance/defer

### Lazy Loading Services

When a part of the logic, rather than the view, is deferrable, `injectAsync`, which I've introduced here, is the choice. If logic that uses a large third-party library is not needed for the initial load and its loading can be triggered when needed, that's where `injectAsync` comes in.

https://angular.jp/best-practices/performance/lazy-loading-services

### Lazy Loading Modules

Finally, it's a method often forgotten because it's not an Angular API, but lazy loading at the module level can be achieved simply by using standard ES Module dynamic imports (`import(...)`). This is because dynamic imports are converted into lazy loading within the Angular CLI build process. If the target to be loaded is just a function, class, or constant, it doesn't involve Angular's dependency injection or component system, so using plain dynamic imports is sufficient.

You could split by the service that uses it—such as a library used only in specific use cases—or you could reference the service statically and then split by module inside it. This can be decided based on implementation preference. The only difference is whether the responsibility for asynchronous processing lies outside or inside the service. Personally, I think if `injectAsync` can cover it, that's fine, but when complex DI provider definitions are required, I wonder if it might be better to combine it with module-level lazy loading as appropriate.

## Summary

- `injectAsync` enables bundle splitting and lazy loading at the service level by replacing DI references with dynamic imports.
- It is limited to services declared with `@Injectable({ providedIn: 'root' })` or `@Service()`, and does not support complex provider definitions.
- Lazy loading methods and units provided by Angular:
  - Routes: `loadChildren` / `loadComponent`
  - Partial Views: `@defer`
  - Services: `injectAsync`
  - Other modules: `import(...)`